import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No document file provided" }, { status: 400 });
    }

    const filename = file.name || "document.docx";
    const ext = path.extname(filename).toLowerCase();

    if (ext !== ".docx" && ext !== ".doc") {
      return NextResponse.json({ error: "Unsupported file extension. Only .docx and .doc are supported." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Check if external cloud converter URL or local LibreOffice (soffice) binary is available
    const externalConverterUrl = process.env.DOC_CONVERTER_URL;
    if (externalConverterUrl) {
      try {
        const cloudFormData = new FormData();
        cloudFormData.append("file", new Blob([fileBuffer]), filename);
        
        const response = await fetch(externalConverterUrl, {
          method: "POST",
          body: cloudFormData,
        });

        if (response.ok) {
          const pdfBuffer = await response.arrayBuffer();
          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename.replace(/\.(docx|doc)$/i, "")}.pdf"`,
            },
          });
        }
      } catch (err) {
        console.warn("External cloud converter notice:", err);
      }
    }

    // Try executing local soffice if installed on server OS
    try {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "doc-conv-"));
      const inputPath = path.join(tempDir, filename);
      await fs.writeFile(inputPath, fileBuffer);

      // Execute soffice in headless mode
      await execAsync(`soffice --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`, {
        timeout: 15000,
      });

      const pdfFilename = `${path.basename(filename, ext)}.pdf`;
      const pdfPath = path.join(tempDir, pdfFilename);

      const pdfBuffer = await fs.readFile(pdfPath);

      // Cleanup temp files immediately
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdfFilename}"`,
        },
      });
    } catch (sofficeErr) {
      // Local soffice not installed or timed out. Signal client to use high-precision local AST renderer
      return NextResponse.json({
        success: false,
        fallbackToClient: true,
        message: "Server conversion engine unavailable, utilizing high-precision client renderer.",
      }, { status: 200 });
    }

  } catch (err: any) {
    console.error("API convert-doc error:", err);
    return NextResponse.json({ error: err.message || "Failed to process Word document" }, { status: 500 });
  }
}
