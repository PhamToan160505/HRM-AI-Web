-- Người được phân công phỏng vấn phải xác nhận lời mời trước khi feedback.

ALTER TABLE `interview_participants`
    ADD COLUMN `invitation_status` ENUM('PENDING','ACCEPTED','DECLINED')
        NOT NULL DEFAULT 'PENDING' AFTER `feedback_required`,
    ADD COLUMN `responded_at` DATETIME(6) NULL AFTER `invited_at`,
    ADD INDEX `idx_interview_participant_invitation`
        (`user_id`, `invitation_status`, `interview_id`);

-- Lịch đã kết thúc hoặc người đã gửi feedback được xem là đã chấp nhận.
UPDATE `interview_participants` participant
JOIN `interviews` interview ON interview.id = participant.interview_id
SET participant.invitation_status = 'ACCEPTED',
    participant.responded_at = COALESCE(participant.responded_at, interview.updated_at)
WHERE interview.status <> 'SCHEDULED';

UPDATE `interview_participants` participant
JOIN `interview_feedbacks` feedback
  ON feedback.interview_id = participant.interview_id
 AND feedback.interviewer_id = participant.user_id
SET participant.invitation_status = 'ACCEPTED',
    participant.responded_at = COALESCE(participant.responded_at, feedback.submitted_at);

-- Bù thông báo cho các lời mời đang hoạt động được tạo trước migration này.
INSERT INTO `notifications`
    (`user_id`, `loai`, `tieu_de`, `noi_dung`, `muc_do`, `da_doc`, `lien_ket`, `created_at`)
SELECT participant.user_id,
       'INTERVIEW_INVITATION',
       CONCAT('Lời mời phỏng vấn vòng ', interview.round_number),
       CONCAT('Bạn được mời tham gia phỏng vấn ứng viên ', application.full_name,
              ' cho vị trí ', posting.title,
              '. Vui lòng mở hồ sơ để chấp nhận hoặc từ chối lời mời.'),
       'binh_thuong', b'0',
       CONCAT('/recruitment/applications/', application.id),
       CURRENT_TIMESTAMP(6)
FROM `interview_participants` participant
JOIN `interviews` interview ON interview.id = participant.interview_id
JOIN `applications` application ON application.id = interview.application_id
JOIN `job_postings` posting ON posting.id = application.job_posting_id
WHERE interview.status = 'SCHEDULED'
  AND participant.invitation_status = 'PENDING'
  AND NOT EXISTS (
      SELECT 1 FROM `notifications` notification
      WHERE notification.user_id = participant.user_id
        AND notification.loai = 'INTERVIEW_INVITATION'
        AND notification.lien_ket = CONCAT('/recruitment/applications/', application.id)
  );
