const fileInput = document.getElementById("fileInput");
const sendButton = document.getElementById("sendButton");
const fileDetails = document.getElementById("fileDetails");
const statusMessage = document.getElementById("statusMessage");

let selectedFile = null;

const userId = "dusoshsuofusfjjcso";

const uploadSessionId = Date.now().toString();
const socket = new WebSocket("ws://localhost:4040");

socket.onopen = () => {
  socket.send(JSON.stringify({ uploadSessionId }));
};

// socket.onmessage = (event) => {
//   const data = JSON.parse(event.data);
//   console.log("Progress:", data.percent + "%");
//   // Update a progress bar here
// };

function generateUploadId() {
  return userId + Math.random().toString(36).substring(2, 10) + Date.now();
}

fileInput.addEventListener("change", (event) => {
  selectedFile = event.target.files[0];
  if (selectedFile) {
    fileDetails.innerHTML = `
      <strong>File Name:</strong> ${selectedFile.name}<br>
      <strong>Size:</strong> ${(selectedFile.size / 1024).toFixed(2)} KB
    `;
    sendButton.disabled = false;
    statusMessage.textContent = "";
  } else {
    fileDetails.innerHTML = "";
    sendButton.disabled = true;
  }
});

sendButton.addEventListener("click", async () => {
  if (!selectedFile) return;

  sendButton.disabled = true;
  statusMessage.textContent = "Sending file...";

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    statusMessage.textContent = `Uploading file: ${data.percent}%`;

    // console.log("Progress:", data.percent + "%");
    // Update a progress bar here
  };

  const uploadId = generateUploadId();
  const formData = new FormData();
  formData.append("filename", selectedFile.name);
  formData.append("uploadId", uploadId);
  //   formData.append("contentType", selectedFile.type);
  formData.append("size", selectedFile.size);
  formData.append("file", selectedFile);

  try {
    const parentId = "93ede701-a030-4f05-b817-fd02a7955ff1";
    const response = await fetch(
      `http://localhost:4040/files/upload?directory=${parentId}`,
      {
        method: "POST",
        body: formData,
        headers: {
          userId: userId,
          uploadSessionId,
        },
      }
    );

    console.log(response.json(), "response");

    if (response.ok) {
      statusMessage.textContent = `✅ File "${selectedFile.name}" sent successfully!`;
    } else {
      statusMessage.textContent = `❌ Failed to send file. Server responded with status ${response.status}`;
    }
  } catch (error) {
    statusMessage.textContent = `❌ Error sending file: ${error.message}`;
  }

  fileInput.value = "";
  fileDetails.innerHTML = "";
  selectedFile = null;
});
