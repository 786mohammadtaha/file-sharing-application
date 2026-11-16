# FILE SHARING APPLICATION
## Technical Documentation

## 1. Project Overview

The File Sharing Application is a web-based file transfer system designed to transfer files between one computer and one mobile phone over a Local Area Network (LAN).

The application uses a Node.js server running on the computer. Both the computer and phone access the server through their web browsers.

The application provides a common file queue where both devices can upload, download, and delete files.

### Main Features

- File transfer between computer and phone.
- LAN-based communication.
- Web-based dashboards for both devices.
- QR code generation for easy phone connection.
- Common file queue shared between both devices.
- Real-time queue updates using HTTP Long Polling.
- Maximum queue capacity of 10 files.
- File download and deletion from either device.
- Random security token generated whenever the server starts.

---

## 2. Architecture

The application follows a client-server architecture.

There are three main components:

1. Node.js Server
2. Computer Dashboard
3. Phone Dashboard

The Node.js server runs on the computer and acts as the central communication point between both devices.

### Architecture Diagram

```text
                 COMPUTER
                     |
             Node.js Server
                Port 3000
                     |
          +----------+----------+
          |                     |
     HTTP REST API         File Storage
          |                 uploads/
          |                     |
     Common File Queue ---------+
          |
     +----+----------------+
     |                     |
Computer Dashboard    Phone Dashboard
computer.html          phone.html
     |                     |
     +----------+----------+
                |
             PHONE
```

### How the Architecture Works

- The Node.js server runs on the computer.
- The computer dashboard is accessed through localhost.
- The server generates a random token.
- The server generates a QR code containing its LAN IP address and token.
- The phone scans the QR code and opens the application in its browser.
- Both dashboards communicate with the server using HTTP REST APIs.
- Uploaded files are stored in the server's uploads directory.
- Both devices access the same file queue.
- Long polling keeps both dashboards updated.

The server acts as the central authority for file storage and queue management.

---

## 3. Project Structure

```text
file-sharing/
│
├── server.js
├── computer.html
├── phone.html
│
└── uploads/
```

### server.js

This is the main backend file.

Responsibilities:

- Initialize the Express server.
- Generate a random access token.
- Detect the computer's LAN IP address.
- Generate QR codes.
- Handle file uploads.
- Maintain the common file queue.
- Handle long polling requests.
- Handle file downloads.
- Handle file deletion.
- Serve the appropriate dashboard.

### computer.html

This file contains the computer dashboard.

Responsibilities:

- Display the QR code.
- Allow file selection.
- Upload files to the server.
- Display upload results.
- Display the common file queue.
- Download files.
- Delete files.

### phone.html

This file contains the phone dashboard.

Responsibilities:

- Allow file selection.
- Upload files to the server.
- Display upload results.
- Display the common file queue.
- Download files.
- Delete files.

The phone dashboard has the same basic interface as the computer dashboard, except it does not display the QR code.

### uploads/

This directory stores all uploaded files.

Every uploaded file is physically saved on the computer running the Node.js server.

Both devices access files through the server rather than communicating directly with each other.

---

## 4. Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| HTML5 | Dashboard structure |
| Vanilla JavaScript | Frontend functionality |
| Fetch API | HTTP communication with server |
| HTML DOM API | Dynamic queue rendering |

No CSS, React, or frontend frameworks are used.

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | HTTP server and REST APIs |
| QRCode | QR code generation |
| dgram | LAN IP address detection |
| fs | File system operations |
| path | File path management |
| os | Network interface information |
| crypto | Random token and file ID generation |

The application uses Node.js built-in modules wherever possible.

---

## 5. Server Configuration

The server runs on port:

```text
3000
```

It listens on:

```javascript
app.listen(PORT, "0.0.0.0", callback);
```

Listening on `0.0.0.0` allows other devices on the same LAN to access the server.

### Important Constants

| Constant | Value | Purpose |
|---|---|---|
| PORT | 3000 | Server port |
| MAX_FILES | 10 | Maximum queue capacity |
| POLL_TIMEOUT | 30000 ms | Long polling timeout |
| UPLOAD_DIRECTORY | uploads/ | File storage directory |

### Random Token Generation

Every time the server starts, a new random token is generated.

```javascript
const token = crypto.randomBytes(16).toString("hex");
```

This generates a 32-character hexadecimal token.

The same token is used throughout the application.

For example:

```text
http://localhost:3000/abc123...
```

The token is not hardcoded.

It is generated dynamically whenever the server starts.

---

## 6. LAN IP Address Detection

The application uses Node.js's `dgram` module to detect the computer's LAN IP address.

The implementation creates a UDP socket and connects it to:

```text
8.8.8.8:80
```

It then retrieves the local address assigned to the socket.

The detected address is used to construct the phone connection URL.

Example:

```text
http://192.168.1.5:3000/<random_token>
```

This URL is encoded into the QR code.

The phone and computer must be connected to the same reachable local network.

---

## 7. QR Code Generation

The computer dashboard displays a QR code to simplify phone connection.

The QR code contains:

```text
http://<computer_lan_ip>:3000/<random_token>
```

### Working

1. The computer opens the application.
2. The computer dashboard requests the QR code.
3. The server detects its LAN IP address.
4. The server constructs the phone URL.
5. The QRCode library generates a PNG image.
6. The server sends the image to the computer dashboard.
7. The dashboard displays the QR code.

The phone scans the QR code and opens the application directly.

---

## 8. Dashboard Selection

Both dashboards use the same token-based URL structure.

The server determines which dashboard to serve based on the client's connection address.

- Local computer request: `computer.html`
- Remote LAN request: `phone.html`

The computer accesses:

```text
http://localhost:3000/
```

The phone accesses:

```text
http://<computer_lan_ip>:3000/<random_token>
```

The root route redirects the computer to the generated token route.

---

## 9. Common File Queue

The application maintains a single common file queue.

Both the computer and phone read and write to this queue.

### Queue Structure

Each file contains the following information:

| Field | Description |
|---|---|
| id | Unique file identifier |
| name | Original file name |
| storedName | File name used in server storage |
| time | Upload time |
| date | Upload date |

Example:

```javascript
{
    id: "unique-file-id",
    name: "document.pdf",
    storedName: "unique-file-id__document.pdf",
    time: "08:30 PM",
    date: "16/11/2026"
}
```

### Queue Capacity

The maximum queue capacity is 10 files.

When a new file is uploaded and the queue already contains 10 files:

1. The oldest file is removed from the queue.
2. Its physical file is deleted from the uploads directory.
3. The new file is stored.
4. The queue is updated.

Therefore, the queue always contains a maximum of 10 files.

### Queue Persistence

The file queue is maintained in server memory.

However, the actual files are stored on disk inside the uploads directory.

When the server restarts, it scans the uploads directory and reconstructs the queue using the stored files.

This allows previously uploaded files to remain available after a server restart, subject to the 10-file limit.

---

## 10. File Upload Working

Both devices upload files through HTTP POST requests.

The file is transferred as binary data using the `application/octet-stream` content type.

The original file name is passed through the `X-File-Name` HTTP header.

### Phone to Computer

1. The user selects a file on the phone.
2. The user clicks Send.
3. The phone sends an HTTP POST request.
4. The server receives the binary file.
5. The server checks the queue capacity.
6. The server generates a unique file ID.
7. The file is stored inside uploads/.
8. The file is added to the common queue.
9. The server notifies waiting clients.
10. The computer dashboard receives the updated queue.

### Computer to Phone

The working is exactly the same.

The computer selects and uploads a file.

The server stores it and updates the common queue.

The phone receives the updated queue through long polling.

---

## 11. HTTP REST API Endpoints

All API endpoints use the dynamically generated token.

### 11.1 File Upload Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/<token>/api/files/phone` | Phone uploads a file |
| POST | `/<token>/api/files/pc` | Computer uploads a file |
| POST | `/<token>/api/files/` | Generic file upload |

Request headers:

```text
Content-Type: application/octet-stream
X-File-Name: document.pdf
```

Request body:

Binary file data.

Successful response:

```json
{
    "success": true,
    "message": "File uploaded successfully.",
    "file": {
        "id": "unique-file-id",
        "name": "document.pdf",
        "time": "08:30 PM",
        "date": "16/11/2026"
    }
}
```

### 11.2 Long Polling Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/<token>/api/files/poll/pc` | Computer waits for queue updates |
| GET | `/<token>/api/files/poll/phone` | Phone waits for queue updates |
| GET | `/<token>/api/files/poll/` | Generic polling endpoint |

Example:

```text
GET /<token>/api/files/poll/pc?version=5
```

Successful response:

```json
{
    "version": 6,
    "files": [
        {
            "id": "unique-file-id",
            "name": "document.pdf",
            "time": "08:30 PM",
            "date": "16/11/2026"
        }
    ]
}
```

### 11.3 File Download Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/<token>/api/files/:id/download` | Download a file |

Example:

```text
GET /<token>/api/files/unique-file-id/download
```

The server finds the requested file and sends it as a downloadable attachment.

### 11.4 File Delete Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| DELETE | `/<token>/api/files/:id` | Delete a file |

Example:

```text
DELETE /<token>/api/files/unique-file-id
```

The server:

1. Finds the requested file.
2. Deletes the physical file from uploads/.
3. Removes the file from the common queue.
4. Updates the queue version.
5. Notifies waiting clients.

### 11.5 QR Code Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/<token>/qr` | Fetch the QR code |

The endpoint returns a PNG image containing the phone connection URL.

---

## 12. HTTP Long Polling

The application uses HTTP Long Polling to keep both dashboards updated.

Long polling allows a client to send a request and wait until new information becomes available.

Unlike normal polling, the server does not immediately return a response if there are no changes.

### Why Long Polling?

The computer and phone share the same file queue.

Whenever either device uploads or deletes a file, the other device should receive the updated queue.

Long polling provides this functionality without requiring WebSockets.

### Working

1. The client sends a GET request containing its last received queue version.
2. The server compares the requested version with the current queue version.
3. If the versions are different, the server immediately returns the updated queue.
4. If the versions are identical, the server keeps the request open.
5. When a file is uploaded or deleted, the server increments the queue version.
6. The server notifies all waiting clients.
7. The clients receive the updated queue.
8. The clients immediately send another polling request.

### Timeout

The polling timeout is:

```javascript
const POLL_TIMEOUT = 30000;
```

This means every long polling request times out after 30 seconds if no queue changes occur.

After receiving a response, the client sends another polling request.

### Queue Version

The server maintains:

```javascript
let queueVersion = 0;
```

Whenever the queue changes:

```javascript
queueVersion++;
```

The version helps the server determine whether the client needs an updated queue.

---

## 13. File Download and Deletion

Both dashboards provide Download and Delete buttons for every file in the queue.

### Download

When the user clicks Download:

1. The browser sends a GET request.
2. The server identifies the file using its unique ID.
3. The server locates the physical file.
4. The server sends the file to the browser.

Both devices can download any file in the queue.

### Delete

When the user clicks Delete:

1. The browser sends a DELETE request.
2. The server identifies the file.
3. The server removes it from disk.
4. The server removes it from the common queue.
5. The server increments the queue version.
6. Both dashboards receive the updated queue.

Both devices can delete any file in the queue.

---

## 14. User Interface

Both dashboards are implemented using plain HTML and JavaScript.

No CSS is used.

### Computer Dashboard

The computer dashboard contains:

1. QR Code
2. File Picker
3. Send Button
4. Upload Result
5. Queue

Each queue item displays:

- File ID
- File Name
- Upload Time
- Upload Date
- Download Button
- Delete Button

### Phone Dashboard

The phone dashboard contains:

1. File Picker
2. Send Button
3. Upload Result
4. Queue

Each queue item displays:

- File ID
- File Name
- Upload Time
- Upload Date
- Download Button
- Delete Button

Both dashboards dynamically render queue items using JavaScript DOM manipulation.

---

## 15. Complete Application Workflow

### Initial Startup

1. User starts the Node.js server.
2. Server generates a new random token.
3. Server initializes the uploads directory.
4. Server loads existing files into the queue.
5. Server registers all API routes.
6. Server detects the computer's LAN IP address.
7. Server starts listening on port 3000.

### Computer Connection

1. User opens localhost:3000.
2. Server redirects the user to the token-based URL.
3. Server serves computer.html.
4. Computer dashboard requests the QR code.
5. Server generates and returns the QR code.
6. Computer dashboard displays it.

### Phone Connection

1. User scans the QR code.
2. Phone opens the computer's LAN IP and token URL.
3. Server identifies the request as a remote LAN request.
4. Server serves phone.html.
5. Phone dashboard starts long polling.

### File Transfer

1. Either device selects a file.
2. The device sends the file to the server.
3. Server stores the file in uploads/.
4. Server adds the file to the common queue.
5. Server increments the queue version.
6. Server notifies waiting clients.
7. Both dashboards display the updated queue.

### File Deletion

1. Either device clicks Delete.
2. The server deletes the physical file.
3. The server removes its queue entry.
4. The server increments the queue version.
5. Both dashboards receive the updated queue.

---

## 16. How to Install and Run

### Prerequisites

- Node.js installed on the computer.
- npm installed.
- Computer and phone connected to the same LAN.
- A web browser on both devices.

### Step 1: Open the Project Directory

```bash
cd file-sharing
```

### Step 2: Install Dependencies

```bash
npm install express qrcode
```

### Step 3: Start the Server

```bash
node server.js
```

### Step 4: Open the Computer Dashboard

Open:

```text
http://localhost:3000/
```

### Step 5: Connect the Phone

Scan the QR code displayed on the computer dashboard.

The phone dashboard will open automatically.

### Step 6: Transfer Files

- Select a file.
- Click Send.
- Wait for the upload result.
- The file will appear in the common queue on both devices.

Both devices can now download or delete files.

---

## 17. Important Technical Characteristics

| Characteristic | Implementation |
|---|---|
| Architecture | Client-server |
| Network | Local Area Network |
| Server | Node.js |
| Server framework | Express.js |
| Communication | HTTP REST API |
| Queue synchronization | HTTP Long Polling |
| Polling timeout | 30 seconds |
| Queue capacity | 10 files |
| File storage | Local filesystem |
| File identification | Unique random ID |
| Session identification | Random token |
| Server port | 3000 |
| Frontend | HTML5 and Vanilla JavaScript |
| Styling | No CSS |
| Frontend framework | None |
| Database | None |
| WebSocket | Not used |

---

## 18. Project Limitations and Scope

- The application is designed for LAN-based file sharing.
- The application uses one Node.js server.
- The application supports one computer and one phone as its intended setup.
- The application does not use a database.
- Uploaded files are stored directly on the computer's filesystem.
- The queue is limited to 10 files.
- Both devices must be able to reach the computer over the local network.
- The server must remain running during file transfers.
- The application does not implement user accounts or individual user authentication.
- The random token provides an additional URL-level access barrier, but it is not a substitute for authenticated access or encrypted communication.

---

## 19. Conclusion

The File Sharing Application provides a simple way to transfer files between a computer and a mobile phone without using external cloud storage or third-party file-sharing services.

A central Node.js server manages file uploads, downloads, deletions, and queue synchronization.

The use of HTTP REST APIs and Long Polling allows both devices to share a common file queue and receive updates automatically.

The application uses a lightweight technology stack consisting of Node.js, Express.js, HTML5, Vanilla JavaScript, and Node.js built-in modules.

Its simple architecture makes it easy to understand, maintain, and extend.
