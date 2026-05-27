import { OAuth2Client } from "google-auth-library";
import { drive } from "@googleapis/drive";
import { Readable } from "stream";

/**
 * Service to handle Google Drive operations for MotorX documents
 */
class GoogleDriveService {
    constructor() {
        this._auth = null;
        this._drive = null;
    }

    /**
     * Lazy initialization of the Drive client
     */
    get drive() {
        if (!this._drive) {
            this._auth = new OAuth2Client(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET
            );

            this._auth.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            });

            this._drive = drive({ version: "v3", auth: this._auth });
        }
        return this._drive;
    }

    /**
     * Finds a folder by name and parentId, or creates it if it doesn't exist
     */
    async findOrCreateFolder(folderName, parentId = null) {
        let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        const response = await this.drive.files.list({
            q: query,
            fields: "files(id, name)",
            spaces: "drive",
        });

        if (response.data.files.length > 0) {
            return response.data.files[0].id;
        }

        // Create folder if not found
        const fileMetadata = {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentId ? [parentId] : [],
        };

        const folder = await this.drive.files.create({
            resource: fileMetadata,
            fields: "id",
        });

        console.log(`[Drive] Folder created: ${folderName} (ID: ${folder.data.id})`);
        return folder.data.id;
    }

    /**
     * Uploads a file to the hierarchical path: Documents/YYYY/MM/VIN/[subFolder]/
     */
    async uploadFileToVINPath(vin, filename, buffer, mimeType = "application/pdf", subFolder = null) {
        try {
            const now = new Date();
            const year = now.getFullYear().toString();
            const month = (now.getMonth() + 1).toString().padStart(2, "0");

            // 1. Root Documents folder
            const rootId = await this.findOrCreateFolder("Documents");
            
            // 2. Year folder
            const yearId = await this.findOrCreateFolder(year, rootId);
            
            // 3. Month folder
            const monthId = await this.findOrCreateFolder(month, yearId);
            
            // 4. VIN folder
            const targetFolderId = await this.findOrCreateFolder(vin, monthId);

            // 5. Check if file already exists
            const existingFileQuery = `name = '${filename}' and '${targetFolderId}' in parents and trashed = false`;
            const existingFiles = await this.drive.files.list({
                q: existingFileQuery,
                fields: "files(id)",
            });

            const fileMetadata = {
                name: filename,
                parents: [targetFolderId],
            };

            const media = {
                mimeType: mimeType,
                body: ReadableStreamFromBuffer(buffer),
            };

            let response;
            if (existingFiles.data.files.length > 0) {
                const fileId = existingFiles.data.files[0].id;
                response = await this.drive.files.update({
                    fileId: fileId,
                    media: media,
                    fields: "id, name, webViewLink",
                });
                console.log(`[Drive] File updated: ${filename} in VIN ${vin}`);
            } else {
                response = await this.drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: "id, name, webViewLink",
                });
                console.log(`[Drive] File created: ${filename} in VIN ${vin}`);
            }

            return {
                id: response.data.id,
                name: response.data.name,
                webViewLink: response.data.webViewLink,
            };
        } catch (error) {
            console.error("[Drive Error] Upload failed:", error);
            throw error;
        }
    }

    /**
     * Finds a folder ID by its path string relative to "Documents" root
     */
    async findFolderByPath(pathStr) {
        try {
            let currentParentId = await this.findOrCreateFolder("Documents");
            if (!pathStr || pathStr === "" || pathStr === "/") {
                return currentParentId;
            }

            const segments = pathStr.split("/").filter(Boolean);
            for (const segment of segments) {
                const query = `name = '${segment}' and mimeType = 'application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed = false`;
                const response = await this.drive.files.list({
                    q: query,
                    fields: "files(id)",
                });

                if (response.data.files.length === 0) {
                    return null; // Path not found
                }
                currentParentId = response.data.files[0].id;
            }
            return currentParentId;
        } catch (error) {
            console.error("[Drive Error] findFolderByPath failed:", error);
            return null;
        }
    }

    /**
     * Lists items in a folder by its path string
     */
    async listItemsByPath(pathStr) {
        try {
            const folderId = await this.findFolderByPath(pathStr);
            if (!folderId) {
                return [];
            }

            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
                orderBy: "folder,name",
            });

            return response.data.files.map((file) => {
                const cleanPath = pathStr.replace(/\/$/, "");
                return {
                    name: file.name,
                    isDirectory: file.mimeType === "application/vnd.google-apps.folder",
                    size: parseInt(file.size || 0),
                    mtime: file.modifiedTime,
                    path: cleanPath ? `${cleanPath}/${file.name}` : file.name,
                    id: file.id,
                    webViewLink: file.webViewLink,
                };
            });
        } catch (error) {
            console.error("[Drive Error] listItemsByPath failed:", error);
            throw error;
        }
    }

    /**
     * Deletes a file or folder in Google Drive by ID
     */
    async deleteItem(fileId) {
        try {
            await this.drive.files.delete({
                fileId: fileId,
            });
            return true;
        } catch (error) {
            console.error("[Drive Error] deleteItem failed:", error);
            throw error;
        }
    }
}

function ReadableStreamFromBuffer(buffer) {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
}

export const driveService = new GoogleDriveService();
