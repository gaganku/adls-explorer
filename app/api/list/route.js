import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { storageAccount, containerName, sasToken, prefix = "" } = await request.json();

    if (!storageAccount || !containerName || !sasToken) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Ensure SAS token starts with '?'
    const formattedSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    // For ADLS Gen2, the endpoint is dfs.core.windows.net
    const accountUrl = `https://${storageAccount}.dfs.core.windows.net${formattedSasToken}`;
    
    const serviceClient = new DataLakeServiceClient(accountUrl);
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);

    const items = [];
    
    // listPaths lists files and directories. 
    // recursive: false gets only the current level.
    const paths = fileSystemClient.listPaths({ path: prefix, recursive: false });
    
    for await (const path of paths) {
      items.push({
        name: path.name, // Full path name e.g., "folder/file.txt"
        basename: path.name.split('/').filter(Boolean).pop() || path.name, // Just "file.txt"
        isDirectory: path.isDirectory,
        contentLength: path.contentLength,
        lastModified: path.lastModified,
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error listing ADLS paths:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
