import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { logAudit, getRequestInfo, AUDIT_ACTIONS } from "@/utils/auditLogger";

export async function POST(request) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return Response.json(
                { error: "Current and new passwords are required" },
                { status: 400 }
            );
        }


        // Validate password strength
        if (newPassword.length < 8) {
            return Response.json(
                { error: "New password must be at least 8 characters long" },
                { status: 400 }
            );
        }

        // Check for password complexity
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumber = /\d/.test(newPassword);
        const hasSpecialChar = /[@$!%*?&]/.test(newPassword);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
            return Response.json(
                { error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)" },
                { status: 400 }
            );
        }


        // Get current user's password hash
        const accountRows = await sql`
      SELECT password 
      FROM auth_accounts 
      WHERE "userId" = ${session.user.id} AND type = 'credentials'
    `;

        if (accountRows.length === 0) {
            return Response.json(
                { error: "Account not found or not using password authentication" },
                { status: 404 }
            );
        }

        const currentHash = accountRows[0].password;

        // Verify current password
        const { verify, hash } = await import("argon2");
        const isValid = await verify(currentHash, currentPassword);

        if (!isValid) {
            return Response.json(
                { error: "Incorrect current password" },
                { status: 400 }
            );
        }

        // Hash new password
        const newHash = await hash(newPassword);

        // Update password
        await sql`
      UPDATE auth_accounts 
      SET password = ${newHash}
      WHERE "userId" = ${session.user.id} AND type = 'credentials'
    `;

        // Log audit event
        const { ipAddress, userAgent } = getRequestInfo(request);
        const currentUserData = await sql`SELECT name, email, role FROM auth_users WHERE id = ${session.user.id}`;
        await logAudit({
            userId: session.user.id,
            userName: currentUserData[0]?.name,
            userEmail: currentUserData[0]?.email,
            userRole: currentUserData[0]?.role,
            action: AUDIT_ACTIONS.PASSWORD_CHANGE,
            resourceType: 'user',
            resourceId: session.user.id.toString(),
            details: { message: 'Password changed successfully' },
            ipAddress,
            userAgent,
            status: 'success'
        });

        return Response.json({ success: true, message: "Password updated successfully" });

    } catch (error) {
        console.error("Change password error:", error);
        return Response.json({
            error: process.env.NODE_ENV === 'production'
                ? "Failed to change password"
                : error.message
        }, { status: 500 });
    }
}
