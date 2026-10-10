declare module "dom-to-image-more" {
  function toPng(node: HTMLElement, options?: object): Promise<string>;
  function toJpeg(node: HTMLElement, options?: object): Promise<string>;
  function toBlob(node: HTMLElement, options?: object): Promise<Blob>;
  export default { toPng, toJpeg, toBlob };
}
