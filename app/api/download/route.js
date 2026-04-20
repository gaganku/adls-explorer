import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { storageAccount, containerName, sasToken, filePath } = await request.json();

    if (!storageAccount || !containerName || !sasToken || !filePath) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const formattedSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    const accountUrl = `https://${storageAccount}.dfs.core.windows.net${formattedSasToken}`;
    
    const serviceClient = new DataLakeServiceClient(accountUrl);
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    const fileClient = fileSystemClient.getFileClient(filePath);

    const downloadResponse = await fileClient.read();
    
    // Wrap Node.js readable stream in a Web ReadableStream for Next.js response
    const readableStream = new ReadableStream({
      start(controller) {
        downloadResponse.readableStreamBody.on('data', (chunk) => controller.enqueue(chunk));
        downloadResponse.readableStreamBody.on('end', () => controller.close());
        downloadResponse.readableStreamBody.on('error', (err) => controller.error(err));
      }
    });

    const basename = filePath.split('/').filter(Boolean).pop() || 'download';

    return new NextResponse(readableStream, {
      headers: {
        'Content-Disposition': `attachment; filename="${basename}"`,
        'Content-Type': downloadResponse.contentType || 'application/octet-stream',
      },
    });

  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
