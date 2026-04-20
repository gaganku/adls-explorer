import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { storageAccount, containerName, sasToken, folderPath } = await request.json();

    if (!storageAccount || !containerName || !sasToken || !folderPath) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const formattedSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    const accountUrl = `https://${storageAccount}.dfs.core.windows.net${formattedSasToken}`;
    
    const serviceClient = new DataLakeServiceClient(accountUrl);
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    
    const directoryClient = fileSystemClient.getDirectoryClient(folderPath);
    await directoryClient.create();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
