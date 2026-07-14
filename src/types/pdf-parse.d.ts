declare module "pdf-parse/lib/pdf-parse.js" {
  function pdf(data: Buffer): Promise<{ text: string }>;
  export default pdf;
}
