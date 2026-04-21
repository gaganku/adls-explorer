import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { parquetRead, parquetMetadata } from "hyparquet";

// Helper: stream to Buffer
async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Helper: infer column types from values
function inferType(values) {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (sample.length === 0) return "string";

  let isInt = true, isFloat = true, isBool = true, isDate = true;

  for (const v of sample) {
    const s = String(v).trim();
    if (isInt && !/^-?\d+$/.test(s)) isInt = false;
    if (isFloat && isNaN(Number(s))) isFloat = false;
    if (isBool && !["true", "false", "0", "1", "yes", "no"].includes(s.toLowerCase())) isBool = false;
    if (isDate && isNaN(Date.parse(s))) isDate = false;
  }

  if (isBool) return "boolean";
  if (isInt) return "integer";
  if (isFloat) return "float";
  if (isDate) return "datetime";
  return "string";
}

// Helper: build schema from rows array
function buildSchema(rows, columns) {
  return columns.map((col) => {
    const values = rows.map((r) => r[col]);
    const nullCount = values.filter((v) => v === null || v === undefined || v === "").length;
    return {
      name: col,
      type: inferType(values),
      nullable: nullCount > 0,
      nullCount,
      totalCount: values.length,
    };
  });
}

export async function POST(request) {
  try {
    const { storageAccount, containerName, sasToken, filePath } = await request.json();

    if (!storageAccount || !containerName || !sasToken || !filePath) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const ext = filePath.split(".").pop().toLowerCase();
    if (!["csv", "parquet"].includes(ext)) {
      return NextResponse.json({ error: `Preview not supported for .${ext} files. Only CSV and Parquet are supported.` }, { status: 400 });
    }

    // Download file from ADLS
    const formattedSasToken = sasToken.startsWith("?") ? sasToken : `?${sasToken}`;
    const accountUrl = `https://${storageAccount}.dfs.core.windows.net${formattedSasToken}`;
    const serviceClient = new DataLakeServiceClient(accountUrl);
    const fileSystemClient = serviceClient.getFileSystemClient(containerName);
    const fileClient = fileSystemClient.getFileClient(filePath);

    const downloadResponse = await fileClient.read();
    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);
    const fileSizeBytes = buffer.length;

    let rows = [];
    let columns = [];

    if (ext === "csv") {
      const text = buffer.toString("utf-8");
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // keep as strings so we can infer ourselves
      });
      rows = result.data;
      columns = result.meta.fields || [];
    } else if (ext === "parquet") {
      // Convert Node.js Buffer to a pure ArrayBuffer.
      // We slice it to ensure we only get the relevant portion and a fresh ArrayBuffer instance,
      // which avoids 'expected ArrayBuffer' errors in strict hyparquet versions.
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

      // Get column names from metadata
      const metadata = await parquetMetadata(arrayBuffer);
      const schemaLeaves = metadata.schema.filter(
        (s) => s.num_children === undefined || s.num_children === 0
      );
      columns = schemaLeaves.map((s) => s.name).filter(Boolean);

      // hyparquet onChunk delivers ONE COLUMN at a time across row ranges
      const columnArrays = {};
      await parquetRead({
        file: arrayBuffer,
        onChunk: ({ columnName, columnData }) => {
          if (!columnName) return;
          if (!columnArrays[columnName]) columnArrays[columnName] = [];
          for (const val of columnData) columnArrays[columnName].push(val);
        },
      });

      // Fallback: derive columns from what was actually read
      if (columns.length === 0) columns = Object.keys(columnArrays);

      // Transpose column arrays → row objects
      const rowCount = Math.max(0, ...Object.values(columnArrays).map((a) => a.length));
      for (let i = 0; i < rowCount; i++) {
        const row = {};
        for (const col of columns) row[col] = columnArrays[col]?.[i] ?? null;
        rows.push(row);
      }
    }


    const schema = buildSchema(rows, columns);

    return NextResponse.json({
      rows,
      schema,
      columns,
      totalRows: rows.length,
      fileSizeBytes,
      ext,
    });
  } catch (error) {
    console.error("Error previewing file:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
