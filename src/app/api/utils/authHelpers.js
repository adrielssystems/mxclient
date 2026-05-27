import sql from "@/app/api/utils/sql";

/**
 * Checks if the current session has permission to access a specific section.
 * Admins always have access. Employees must have the section in their allowed_sections list.
 * 
 * @param {object} session - Session object from auth()
 * @param {string} section - ID of the section to check
 * @returns {Promise<boolean>} True if access is allowed, false otherwise.
 */
export async function checkSectionPermission(session, section, request = null) {
  if (!session || !session.user?.id) {
    return false;
  }

  try {
    let userId = session.user.id;

    if (request) {
      const cookieHeader = request?.headers?.get?.("cookie") || "";
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map(c => {
          const [key, ...val] = c.trim().split("=");
          return [key, val.join("=")];
        })
      );
      const impersonateCookie = cookies["motorx-impersonate-employee"];
      if (impersonateCookie) {
        try {
          const data = JSON.parse(decodeURIComponent(impersonateCookie));
          if (data.employeeId && data.adminId === session.user.id) {
            // Verify real user is admin
            const adminRows = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
            if (adminRows[0]?.role === "admin") {
              userId = data.employeeId;
            }
          }
        } catch (e) {
          console.error("Invalid employee impersonation cookie in checkSectionPermission:", e);
        }
      }
    }

    const userRows = await sql`
      SELECT role, allowed_sections 
      FROM auth_users 
      WHERE id = ${userId}
    `;

    if (userRows.length === 0) {
      return false;
    }

    const user = userRows[0];

    // Admins always have full access
    if (user.role === "admin") {
      return true;
    }

    // Employees access is based on allowed_sections JSONB array
    if (user.role === "employee") {
      const allowed = user.allowed_sections;
      return Array.isArray(allowed) && allowed.includes(section);
    }

    return false;
  } catch (error) {
    console.error("Error checking section permission:", error);
    return false;
  }
}
