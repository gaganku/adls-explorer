import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { storageAccount, containerName, sasToken, path, isDirectory } = await request.json();

    if (!storageAccount || !containerName || !sasToken || !path) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const formattedSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    const accountUrl = `https://${storageAccount}.dfs.core.windows.net${formattedSasToken}`;
    
    const serviceClient = new DataLakeServiceClient(accountUrl);
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    
    if (isDirectory) {
      const directoryClient = fileSystemClient.getDirectoryClient(path);
      // true means recursive delete
      await directoryClient.delete(true);
    } else {
      const fileClient = fileSystemClient.getFileClient(path);
      await fileClient.delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting path:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
