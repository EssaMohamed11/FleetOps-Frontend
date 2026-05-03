import api from "/shared/api-handler.js";

// التوجيه لباك إند لارافل
api.setBaseURL("http://localhost:8000");

// الدالة دي مبقاش ليها لازمة في الفرونت لأن الـ Backend بيسجل أوتوماتيك
// بس هنسيبها ترجع success عشان لو في كود في الفرونت بيناديها ميكراشش
export async function logAuditAction(userName, userRole, action, entity, entityId, oldValue = null, newValue = null) {
    console.log("Audit logging is now handled automatically by the Backend Middleware.");
    return { success: true };
}

// API: GET /api/v1/audit/logs
export async function getAuditLogs(filters = {}) {
    try {
        // تجميع فلاتر البحث بشكل مباشر كـ Object
        const params = {};
        if (filters.user) params.user_id = filters.user;
        if (filters.entity && filters.entity !== 'All Entities') params.entity_type = filters.entity;
        if (filters.action && filters.action !== 'All Actions') params.action = filters.action;
        if (filters.dateFrom) params.date_from = filters.dateFrom;
        if (filters.dateTo) params.date_to = filters.dateTo;
        if (filters.search) params.search = filters.search;

        // استدعاء الـ API باستخدام الـ handler الجديد
        const { data } = await api.get('/api/v1/audit/system-logs', { params });

        if (data.success) {
            return data.data.data.map(log => {
                
                let ctx = log.context;
                if (typeof ctx === 'string') {
                    try { ctx = JSON.parse(ctx); } catch (e) { ctx = {}; }
                }

                const methodMap = {
                    'POST': 'Created',
                    'PUT': 'Updated',
                    'PATCH': 'Updated',
                    'DELETE': 'Deleted'
                };

                const method = ctx?.method || '';
                const finalAction = methodMap[method.toUpperCase()] || log.action || log.level?.toUpperCase() || 'Updated';

                return {
                    id: log.log_id,
                    userId: log.user_id || 'System',
                    userRole: log.channel,
                    entity: log.module,
                    action: finalAction, 
                    timestamp: log.created_at,
                    details: log.message,
                    oldValue: null,
                    newValue: ctx
                };
            });
        }
        
        return [];
    } catch (error) {
        console.error("Failed to fetch audit logs:", error.data?.message || error.message);
        return [];
    }
}

const AuditApi = {
    logAuditAction,
    getAuditLogs
};

export default AuditApi;