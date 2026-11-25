package com.hrm.sales;

import com.hrm.configuration.service.ConfigurationService;
import com.hrm.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class SalesReminderService {
    private final JdbcTemplate jdbc;
    private final ConfigurationService configuration;
    private final NotificationService notifications;

    @Scheduled(cron = "${app.sales.reminder-cron:0 0 8 * * *}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void remind() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        int noticeDays = configuration.requireInteger("sales.renewal_notice_days");
        if (noticeDays < 0) throw new IllegalStateException("sales.renewal_notice_days phải không âm");
        var tasks = jdbc.queryForList("""
                SELECT a.id, a.subject title, c.owner_id, d.ten_phong FROM sales_activities a
                JOIN sales_customers c ON c.id=a.customer_id JOIN users u ON u.id=c.owner_id
                JOIN departments d ON d.id=u.department_id
                WHERE a.completed_at IS NULL AND a.due_at < ? AND c.active=TRUE AND u.active=b'1'
                """, today.plusDays(1).atStartOfDay());
        for (var task : tasks) {
            if ("SALES".equals(SalesAccess.kind(String.valueOf(task.get("ten_phong"))))) {
                send("ACTIVITY", ((Number)task.get("id")).longValue(), ((Number)task.get("owner_id")).longValue(),
                        today,"Công việc chăm sóc đến hạn",String.valueOf(task.get("title")));
            }
        }
        var contracts = jdbc.queryForList("""
                SELECT k.id,k.contract_number,c.owner_id,d.ten_phong FROM sales_contracts k
                JOIN sales_quotations q ON q.id=k.quotation_id JOIN sales_opportunities o ON o.id=q.opportunity_id
                JOIN sales_customers c ON c.id=o.customer_id JOIN users u ON u.id=c.owner_id
                JOIN departments d ON d.id=u.department_id
                WHERE k.status='CONFIRMED' AND k.end_date BETWEEN ? AND ? AND c.active=TRUE AND u.active=b'1'
                """,today,today.plusDays(noticeDays));
        for (var contract : contracts) {
            if ("SALES".equals(SalesAccess.kind(String.valueOf(contract.get("ten_phong"))))) {
                send("CONTRACT",((Number)contract.get("id")).longValue(),((Number)contract.get("owner_id")).longValue(),
                        today,"Hợp đồng sắp kết thúc","Theo dõi gia hạn hợp đồng " + contract.get("contract_number"));
            }
        }
    }

    private void send(String entity,long id,long recipient,LocalDate day,String title,String body) {
        int claimed = jdbc.update("INSERT IGNORE INTO sales_reminders(entity_type,entity_id,recipient_id,reminder_date) VALUES (?,?,?,?)",
                entity,id,recipient,day);
        if (claimed == 1) notifications.createNotification(recipient,"SALES_REMINDER",title,body,"binh_thuong","/sales");
    }
}
