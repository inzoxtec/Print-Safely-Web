const fs = require('fs');
const path = require('path');

const toolsDir = 'C:\\Users\\Pankaj sharma\\Documents\\frontend\\print-safely\\app\\tools';

const filesToRefactor = [
  'doc-to-pdf/DocxToPdf.tsx',
  'excel-to-pdf/ExcelToPdf.tsx',
  'extract-images/ExtractImages.tsx',
  'extract-text/ExtractText.tsx',
  'grayscale-pdf/GrayscalePdf.tsx',
  'image-to-pdf/ImageToPdf.tsx',
  'page-numbers/PageNumbersPdf.tsx',
  'pdf-to-image/PdfToImage.tsx',
  'protect/ProtectPdf.tsx',
  'redact-pdf/RedactPdf.tsx',
  'reorder-pdf/ReorderPdf.tsx',
  'rotate-pdf/RotatePdf.tsx',
  'sign-pdf/SignPdf.tsx',
  'split-pdf/SplitPdf.tsx',
  'txt-to-pdf/TxtToPdf.tsx',
  'unlock/UnlockPdf.tsx',
  'watermark/WatermarkPdf.tsx',
  'annotate-pdf/AnnotatePdf.tsx',
];

for (const relPath of filesToRefactor) {
  const fullPath = path.join(toolsDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  let code = fs.readFileSync(fullPath, 'utf8');

  // Check if already updated
  if (code.includes('import ToolLayout from')) {
    console.log(`Skipping ${relPath} - already has ToolLayout`);
    continue;
  }

  // 1. Remove unused imports
  code = code.replace(/import Header from ["']@\/app\/components\/Header["'];?\r?\n?/g, '');
  code = code.replace(/import Footer from ["']@\/app\/components\/Footer["'];?\r?\n?/g, '');
  code = code.replace(/import BreadcrumbSchema from ["']@\/app\/components\/BreadcrumbSchema["'];?\r?\n?/g, '');
  code = code.replace(/import ToolAdSidebar from ["']@\/app\/components\/ToolAdSidebar["'];?\r?\n?/g, '');
  
  // Add ToolLayout import if missing
  if (!code.includes('import ToolLayout')) {
    code = code.replace(
      /(import .* from ["'].*["'];?\r?\n)+/,
      (match) => match + 'import ToolLayout from "@/app/components/ToolLayout";\n'
    );
  }

  // 2. Remove isPremium state and sync useEffect if isPremium is not used for anything else
  // Check if isPremium is used for feature gating
  const isPremiumCount = (code.match(/isPremium/g) || []).length;
  // If isPremium is only in declaration, useEffect, and layout branch
  if (isPremiumCount > 0 && !code.includes('isPremium &&') && !code.includes('isPremium ?')) {
    // safe to remove isPremium declaration & effect
    code = code.replace(/const \[isPremium, setIsPremium\] = useState\(false\);?\r?\n?/g, '');
    code = code.replace(/\/\/ Sync plan status from Firestore[\s\S]*?fetchUserPlan\(\);\r?\n?\s*\}, \[user\]\);?\r?\n?/g, '');
    code = code.replace(/useEffect\(\(\) => \{[\s\S]*?fetchUserPlan\(\);\r?\n?\s*\}, \[user\]\);?\r?\n?/g, '');
  }

  // 3. Replace outer layout JSX
  // Pattern: return ( <div className={`min-h-screen...`}> <Header /> <div ...> <aside.../> <main ...> <BreadcrumbSchema items={[...]} /> ... </main> <aside.../> </div> mobileBanner <Footer /> </div> );
  
  // Find breadcrumb items
  const breadcrumbMatch = code.match(/<BreadcrumbSchema\s+items=\{(\[[\s\S]*?\])\}\s*\/>/);
  const breadcrumbsStr = breadcrumbMatch ? breadcrumbMatch[1] : `[
    { name: "Home", url: "https://printsafely.app" },
    { name: "Tools", url: "https://printsafely.app#tools-catalog" },
  ]`;

  // Extract content inside <main ...> ... </main>
  const mainMatch = code.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  let mainContent = mainMatch ? mainMatch[1] : '';

  // Remove <BreadcrumbSchema ... /> from inside mainContent
  mainContent = mainContent.replace(/<BreadcrumbSchema[\s\S]*?\/>\r?\n?/g, '');

  // Check if there is ToolSeoSection / ToolSeoSchema after main or inside return
  const seoSectionMatch = code.match(/(<ToolSeoSection[\s\S]*?\/>)/);
  const seoSchemaMatch = code.match(/(<ToolSeoSchema[\s\S]*?\/>)/);

  const seoSectionStr = seoSectionMatch ? seoSectionMatch[1] : '';
  const seoSchemaStr = seoSchemaMatch ? seoSchemaMatch[1] : '';

  // Clean up duplicate SEO section/schema if mainContent contains them
  if (seoSectionStr) mainContent = mainContent.replace(seoSectionStr, '');
  if (seoSchemaStr) mainContent = mainContent.replace(seoSchemaStr, '');

  const newReturn = `return (
    <ToolLayout
      breadcrumbs={${breadcrumbsStr.trim()}}
    >
${mainContent.trim()}
${seoSectionStr ? '      ' + seoSectionStr.trim() + '\n' : ''}${seoSchemaStr ? '      ' + seoSchemaStr.trim() + '\n' : ''}    </ToolLayout>
  );`;

  // Replace old return block (from 'return (' to the end of component function)
  code = code.replace(/return\s*\(\s*<div className=\{`min-h-screen[\s\S]*?<\/div>\s*\);?\s*\n\}/, `${newReturn}\n}`);

  fs.writeFileSync(fullPath, code, 'utf8');
  console.log(`Refactored ${relPath}`);
}
