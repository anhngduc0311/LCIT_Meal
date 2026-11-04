// One-time, repeatable correction requested by the administrator. Preserve the
// account, roles, sessions and registration IDs; record previous values in audit.
require('dotenv').config({ quiet: true });
const pool = require('../src/config/database');
async function main() {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [[user]] = await db.query("SELECT id,username FROM user WHERE LOWER(username)='quanly' FOR UPDATE");
    if (!user) throw new Error('Account quanly not found');
    const [payments] = await db.query('SELECT id FROM payment WHERE user_id=?', [user.id]);
    if (payments.length) throw new Error('Account has invoices; review before changing registrations');
    const [rows] = await db.query("SELECT id,meal_id,status,guest_count FROM meal_registration WHERE user_id=? AND status<>'cancelled' FOR UPDATE", [user.id]);
    if (rows.some(row => Number(row.guest_count)>0)) throw new Error('Account has linked guests; review guest allocation first');
    await db.query("UPDATE meal_registration SET status='cancelled' WHERE user_id=? AND status<>'cancelled'", [user.id]);
    if (rows.length) await db.query(`INSERT INTO audit_log(log_action,log_target,log_result,log_detail,log_time,status,old_data,new_data)
      VALUES('UPDATE',?,'success',?,NOW(),'success',?,?)`,
    [`user:${user.id}:management-only`, 'Theo yêu cầu admin: tài khoản quanly không phải cán bộ ăn; hủy suất tự động, giữ nguyên quyền quản lý.',
      JSON.stringify(rows), JSON.stringify({userId:user.id,status:'cancelled',count:rows.length})]);
    await db.commit();
    console.log(JSON.stringify({username:user.username,cancelledRegistrations:rows.length,accountPreserved:true}));
  } catch(error) { await db.rollback(); throw error; }
  finally { db.release(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
