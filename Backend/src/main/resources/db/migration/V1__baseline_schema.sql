-- HRM AI legacy schema baseline.
-- Existing non-empty databases are baselined at version 1 and do not execute
-- this file. Fresh databases execute it before later versioned migrations.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_creation_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_id` bigint NOT NULL,
  `chuc_vu` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `department_id` bigint DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `ho_ten` varchar(150) NOT NULL,
  `status` enum('APPROVED','PENDING','REJECTED') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_decision_logs` (
  `is_success` bit(1) DEFAULT NULL,
  `application_id` bigint NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action_type` varchar(255) NOT NULL,
  `decision_reason` text,
  `error_message` varchar(255) DEFAULT NULL,
  `raw_request` text,
  `raw_response` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applications` (
  `fit_score` int DEFAULT NULL,
  `fraud_flagged` bit(1) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_posting_id` bigint NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `cccd_url` varchar(255) DEFAULT NULL,
  `cv_url` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `extracted_data` json DEFAULT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `raw_cv_text` text,
  `approval_status` enum('NEW','OFFER_APPROVED','PENDING_CEO_EVALUATION','PENDING_HR_CV_REVIEW','PENDING_HR_OFFER','PENDING_INTERVIEW_1','PENDING_INTERVIEW_2','PENDING_OFFER_APPROVAL','PENDING_TECH_CV_REVIEW','REJECTED') NOT NULL,
  `is_priority` bit(1) NOT NULL,
  `needs_verification` bit(1) NOT NULL,
  `hr_review_feedback` text,
  `hr_reviewer` varchar(150) DEFAULT NULL,
  `interview1feedback` text,
  `interview1reviewer` varchar(150) DEFAULT NULL,
  `interview2feedback` text,
  `interview2reviewer` varchar(150) DEFAULT NULL,
  `offer_details` text,
  `rejection_reason` text,
  `rejector_name` varchar(150) DEFAULT NULL,
  `tech_review_feedback` text,
  `tech_reviewer` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKrisuup1r36sqpf7hp1b6v1jjg` (`job_posting_id`),
  CONSTRAINT `FKrisuup1r36sqpf7hp1b6v1jjg` FOREIGN KEY (`job_posting_id`) REFERENCES `job_postings` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `date` date NOT NULL,
  `employee_id` bigint NOT NULL,
  `exception_reason` text,
  `exception_status` varchar(255) DEFAULT NULL,
  `is_exception` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(255) NOT NULL,
  `time_in` time(6) NOT NULL,
  `time_out` time(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `loai_nghi_phep` varchar(50) DEFAULT NULL,
  `scan_history` text,
  `location_in` text,
  `location_out` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_group_members` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` bigint NOT NULL,
  `joined_at` datetime(6) DEFAULT NULL,
  `last_read_message_id` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `department_id` bigint DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('DEPARTMENT','EXECUTIVE') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `role` varchar(20) NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK6f0y4l43ihmgfswkgy9yrtjkh` (`user_id`),
  CONSTRAINT `FK6f0y4l43ihmgfswkgy9yrtjkh` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `created_at` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ten_phong` varchar(100) NOT NULL,
  `mo_ta` varchar(255) DEFAULT NULL,
  `is_lock` bit(1) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_histories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `description` text,
  `employee_id` bigint NOT NULL,
  `event_date` datetime(6) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `new_value` text,
  `old_value` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `end_date` date NOT NULL,
  `note` text,
  `reason` text NOT NULL,
  `request_type` enum('HALF_DAY_LEAVE','NORMAL_LEAVE','OVERTIME','SPECIAL_WFH_LEAVE','UNPAID_LEAVE') NOT NULL,
  `start_date` date NOT NULL,
  `status` enum('APPROVED','CANCELLED','PENDING','REJECTED') NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `approver_id` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKo0ob0rogrjgluljy26ec0debd` (`approver_id`),
  KEY `FKgtv68vlu5lufy8972dv8o4yu8` (`user_id`),
  CONSTRAINT `FKgtv68vlu5lufy8972dv8o4yu8` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKo0ob0rogrjgluljy26ec0debd` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `face_embeddings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `embedding_vector` text NOT NULL,
  `employee_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faq_caches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `answer` text NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `hit_count` int NOT NULL,
  `question` text NOT NULL,
  `question_embedding` text NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `deleted_by_sender` bit(1) NOT NULL,
  `group_id` bigint NOT NULL,
  `is_ai` bit(1) NOT NULL,
  `is_recalled` bit(1) NOT NULL,
  `private_user_id` bigint DEFAULT NULL,
  `sender_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ngay_le` date NOT NULL,
  `ten_ngay_le` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK52po3jokm03f7so7ydnbq2i16` (`ngay_le`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_postings` (
  `co_thoa_thuan` bit(1) DEFAULT NULL,
  `so_luong_tuyen` int NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `han_nop_ho_so` datetime(6) NOT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ngay_bat_dau` datetime(6) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `description` text NOT NULL,
  `dia_diem` varchar(255) NOT NULL,
  `muc_luong` varchar(255) DEFAULT NULL,
  `quyen_loi` text,
  `requirements` text,
  `slug` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `cap_bac` varchar(255) DEFAULT NULL,
  `hinh_thuc_lam_viec` varchar(255) NOT NULL,
  `department_id` bigint DEFAULT NULL,
  `job_requisition_id` bigint DEFAULT NULL,
  `target_role` enum('ADMIN','CEO','GIAM_DOC_PHONG_BAN','NHAN_VIEN','TRUONG_PHONG') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK7c02ve9kk0ujxl245re7qpif` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_requisitions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approver_id` bigint DEFAULT NULL,
  `budget` varchar(100) DEFAULT NULL,
  `cap_bac` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `department_id` bigint DEFAULT NULL,
  `description` text,
  `hinh_thuc_lam_viec` varchar(100) DEFAULT NULL,
  `reason` text NOT NULL,
  `rejection_reason` text,
  `requester_id` bigint NOT NULL,
  `requirements` text,
  `so_luong` int NOT NULL,
  `status` enum('APPROVED','PENDING_CEO','POSTED','REJECTED') NOT NULL,
  `target_role` enum('ADMIN','CEO','GIAM_DOC_PHONG_BAN','NHAN_VIEN','TRUONG_PHONG') NOT NULL,
  `title` varchar(150) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `da_doc` bit(1) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `muc_do` varchar(20) DEFAULT NULL,
  `loai` varchar(50) NOT NULL,
  `lien_ket` varchar(255) DEFAULT NULL,
  `noi_dung` text,
  `tieu_de` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_reports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` bigint NOT NULL,
  `department_id` bigint NOT NULL,
  `month` int NOT NULL,
  `report_level` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL,
  `total_employees` int DEFAULT NULL,
  `total_gross_salary` double DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `year` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payrolls` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actual_days` double DEFAULT NULL,
  `allowance` double DEFAULT NULL,
  `base_salary` double DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `employee_id` bigint NOT NULL,
  `late_penalty` double DEFAULT NULL,
  `month` int NOT NULL,
  `net_salary` double DEFAULT NULL,
  `overtime_pay` double DEFAULT NULL,
  `overtime_reason` text,
  `rejection_reason` text,
  `standard_days` double DEFAULT NULL,
  `status` varchar(255) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `year` int NOT NULL,
  `bhtn_amount` double DEFAULT NULL,
  `bhxh_amount` double DEFAULT NULL,
  `bhyt_amount` double DEFAULT NULL,
  `gross_salary` double DEFAULT NULL,
  `thu_nhap_tinh_thue` double DEFAULT NULL,
  `thu_tncn` double DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKb6bmlo25hdpbia3vb6ve3g1be` (`employee_id`,`month`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ai_evaluation` text NOT NULL,
  `employee_id` bigint NOT NULL,
  `generated_at` datetime(6) NOT NULL,
  `nam` int NOT NULL,
  `thang` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salary_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `change_date` datetime(6) DEFAULT NULL,
  `changed_by` bigint DEFAULT NULL,
  `employee_id` bigint NOT NULL,
  `new_allowance` double DEFAULT NULL,
  `new_base_salary` double DEFAULT NULL,
  `old_allowance` double DEFAULT NULL,
  `old_base_salary` double DEFAULT NULL,
  `reason` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `description` varchar(255) DEFAULT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKnm18l4pyovtvd8y3b3x0l2y64` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `active` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `department_id` bigint DEFAULT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `ho_ten` varchar(150) NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('ADMIN','CEO','GIAM_DOC_PHONG_BAN','NHAN_VIEN','TRUONG_PHONG') NOT NULL,
  `cccd` varchar(20) DEFAULT NULL,
  `cccd_back_public_id` varchar(255) DEFAULT NULL,
  `cccd_front_public_id` varchar(255) DEFAULT NULL,
  `dia_chi` varchar(255) DEFAULT NULL,
  `ngay_cap_cccd` date DEFAULT NULL,
  `ngay_sinh` date DEFAULT NULL,
  `noi_cap_cccd` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `que_quan` varchar(255) DEFAULT NULL,
  `chuc_vu` varchar(100) DEFAULT NULL,
  `allowance` double DEFAULT NULL,
  `base_salary` double DEFAULT NULL,
  `so_nguoi_phu_thuoc` int NOT NULL,
  `ma_nhan_vien` varchar(10) DEFAULT NULL,
  `team_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`),
  UNIQUE KEY `UK8fbyq55x1lpfkor1yn13cq6mc` (`ma_nhan_vien`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
