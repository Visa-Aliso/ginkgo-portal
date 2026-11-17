/// <reference types="vite/client" />

declare module "*.config?data" { const value: unknown; export default value; }

declare module "lucide/dist/esm/icons/*.mjs" {
  const icon: import("lucide").IconNode;
  export default icon;
}
declare module "lucide/dist/esm/replaceElement.mjs" {
  export default function replaceElement(element: Element, options: {
    nameAttr: string;
    icons: Record<string, import("lucide").IconNode>;
    attrs: import("lucide").SVGProps;
  }): Element | undefined;
}
