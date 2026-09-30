import path from "node:path";
import { fileURLToPath } from "node:url";
import { rspack } from "@rspack/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (_env = {}, argv = {}) => {
  const isDev = argv.mode !== "production";

  return {
    target: "web",
    entry: path.resolve(__dirname, "src/main.tsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      publicPath: isDev ? "/" : "./",
      filename: "wave.bundle.js",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          include: path.resolve(__dirname, "src"),
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: { syntax: "typescript", tsx: true },
              transform: {
                react: { runtime: "automatic", development: isDev },
              },
              target: "es2022",
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
      ],
    },
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: path.resolve(__dirname, "index.html"),
        filename: "index.html",
        inject: "body",
        minify: !isDev,
      }),
    ],
    devtool: isDev ? "eval-source-map" : false,
    stats: "errors-warnings",
    performance: { hints: false },
    optimization: { splitChunks: false, runtimeChunk: false },
    devServer: isDev
      ? {
          host: "127.0.0.1",
          port: 5176,
          hot: true,
          historyApiFallback: true,
        }
      : undefined,
  };
};
