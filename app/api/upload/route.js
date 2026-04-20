import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const storageAccount = formData.get("storageAccount");
    const containerName = formData.get("containerName");
    const sasToken = formData.get("sasToken");
    const filePath = formData.get("filePath");
    const file = formData.get("file");

    if (!storageAccount || !containerName || !sasToken || !filePath || !file) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const formattedSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    const accountUrl = `https://${storageAccount}.dfs.core.windows.net${formattedSasToken}`;
    
    const serviceClient = new DataLakeServiceClient(accountUrl);
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    const fileClient = fileSystemClient.getFileClient(filePath);

    // Convert Web File to ArrayBuffer, then Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create the file
    await fileClient.create();
    
    // Append data
    await fileClient.append(buffer, 0, buffer.length);
    
    // Flush to commit
    await fileClient.flush(buffer.length);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
