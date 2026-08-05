export function getById(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

export function getShadowRoot(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element?.shadowRoot) {
    throw new Error(`Missing shadow root ${selector}`);
  }
  return element.shadowRoot;
}
