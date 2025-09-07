import xss from "xss";
export const sanitize = (s) =>
  xss(String(s ?? "").trim(), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script","style"] });
