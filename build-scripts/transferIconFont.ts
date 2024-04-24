import path from "path";
import { readFileSync, writeFileSync, rmSync } from "fs";

/** 原iconfont目录 */
const INPUT_ICON_FONT_DIR = path.resolve(".", "src/assets", "iconfont");
/** 输出目录 */
const OUT_PUT_DIR = path.resolve(".", "src/assets");
/** 是否删除原目录 */
const DELETE_ORIGIN_DIR = true;

/**
 * 解析通过iconfont下载解压后的iconfont.js文件, 获取其中的svg输出到目标目录中
 * @param {*} targetDir
 * @param {*} outputPath
 */
const transferIconFont = (
  targetDir: string,
  outputPath: string,
  deleteOrigin?: boolean
) => {
  // 原目录中iconfont文件
  const targetPath = path.resolve(targetDir, "iconfont.js");
  // 读取文件内容
  const fileContent = readFileSync(targetPath, "utf-8");
  // 通过symbol标签正则分割svg
  const symbols = fileContent.match(/<symbol[\s\S]*?<\/symbol>/g);
  if (!symbols) {
    console.error("<symbol>标签匹配失败");
    return;
  }
  // 遍历分割的symbol标签生成svg图标
  symbols.forEach((symbolStr) => {
    createSvgFile(symbolStr, outputPath);
  });
  // 删除原目录
  if (deleteOrigin) {
    rmSync(targetDir, { recursive: true });
  }
};

const createSvgFile = (symbolStr: string, outputDir: string) => {
  // 获取icon的id, 组成文件名
  const iconId = symbolStr.match(/<symbol id="([^"]*)"/)?.[1];
  if (!iconId) {
    console.error("文件id获取失败, 文件内容为: ", symbolStr);
    return;
  }
  // 生成文件名
  const fileName = `${iconId}.svg`;
  const outputPath = path.join(outputDir, fileName);
  // 替换首位symbol标签
  const svgStr = symbolStr
    .replace(/<symbol id=/, "<svg id=")
    .replace(/<\/symbol>/, "</svg>");
  // 组成svg文件内容
  const svgFileContent = svgStr;

  // 向目标路径写入文件
  writeFileSync(outputPath, svgFileContent);
};

transferIconFont(INPUT_ICON_FONT_DIR, OUT_PUT_DIR, DELETE_ORIGIN_DIR);
