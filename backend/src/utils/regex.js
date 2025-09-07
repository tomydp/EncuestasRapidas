export const questionRe = /^[\p{L}\p{N}\s.,;:?!¡¿'"()-]{10,140}$/u;
export const optionLineRe = /^[^<>]{1,50}$/;
export const validResponseTypes = new Set(["single","multiple"]);
