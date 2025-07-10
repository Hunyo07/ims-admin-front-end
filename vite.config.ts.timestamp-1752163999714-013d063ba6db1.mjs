// vite.config.ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "file:///D:/JESTER%20GALINO%20SCHOOL%20PROJECTS%20AND%20CAPSTONE/CAPSTONE%20REPO%20LATEST%20IMS/ims-admin-front-end/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/JESTER%20GALINO%20SCHOOL%20PROJECTS%20AND%20CAPSTONE/CAPSTONE%20REPO%20LATEST%20IMS/ims-admin-front-end/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueJsx from "file:///D:/JESTER%20GALINO%20SCHOOL%20PROJECTS%20AND%20CAPSTONE/CAPSTONE%20REPO%20LATEST%20IMS/ims-admin-front-end/node_modules/@vitejs/plugin-vue-jsx/dist/index.mjs";
import circleDependency from "file:///D:/JESTER%20GALINO%20SCHOOL%20PROJECTS%20AND%20CAPSTONE/CAPSTONE%20REPO%20LATEST%20IMS/ims-admin-front-end/node_modules/vite-plugin-circular-dependency/dist/index.mjs";
var __vite_injected_original_import_meta_url = "file:///D:/JESTER%20GALINO%20SCHOOL%20PROJECTS%20AND%20CAPSTONE/CAPSTONE%20REPO%20LATEST%20IMS/ims-admin-front-end/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    circleDependency({
      outputFilePath: "./circleDepReport.txt"
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      vue: "vue/dist/vue.esm-bundler.js"
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
          if (id.includes("/src/views/")) {
            return "views";
          }
          if (id.includes("/src/components/")) {
            return "components";
          }
        }
      }
    },
    chunkSizeWarningLimit: 2e3
    // (in KB, e.g., 1500 = 1.5MB)
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxKRVNURVIgR0FMSU5PIFNDSE9PTCBQUk9KRUNUUyBBTkQgQ0FQU1RPTkVcXFxcQ0FQU1RPTkUgUkVQTyBMQVRFU1QgSU1TXFxcXGltcy1hZG1pbi1mcm9udC1lbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEpFU1RFUiBHQUxJTk8gU0NIT09MIFBST0pFQ1RTIEFORCBDQVBTVE9ORVxcXFxDQVBTVE9ORSBSRVBPIExBVEVTVCBJTVNcXFxcaW1zLWFkbWluLWZyb250LWVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovSkVTVEVSJTIwR0FMSU5PJTIwU0NIT09MJTIwUFJPSkVDVFMlMjBBTkQlMjBDQVBTVE9ORS9DQVBTVE9ORSUyMFJFUE8lMjBMQVRFU1QlMjBJTVMvaW1zLWFkbWluLWZyb250LWVuZC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJ1xyXG5cclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXHJcbmltcG9ydCB2dWVKc3ggZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlLWpzeCdcclxuaW1wb3J0IGNpcmNsZURlcGVuZGVuY3kgZnJvbSAndml0ZS1wbHVnaW4tY2lyY3VsYXItZGVwZW5kZW5jeSc7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFtcclxuICAgIHZ1ZSgpLFxyXG4gICAgdnVlSnN4KCksXHJcbiAgICBjaXJjbGVEZXBlbmRlbmN5KHtcclxuICAgICAgb3V0cHV0RmlsZVBhdGg6ICcuL2NpcmNsZURlcFJlcG9ydC50eHQnLFxyXG4gICAgfSksXHJcblxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksICBcclxuICAgICAgdnVlOiAndnVlL2Rpc3QvdnVlLmVzbS1idW5kbGVyLmpzJyxcclxuICAgIH1cclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBzb3VyY2VtYXA6IHRydWUsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ3ZlbmRvcic7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zcmMvdmlld3MvJykpIHtcclxuICAgICAgICAgICAgcmV0dXJuICd2aWV3cyc7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zcmMvY29tcG9uZW50cy8nKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2NvbXBvbmVudHMnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMjAwMCAvLyAoaW4gS0IsIGUuZy4sIDE1MDAgPSAxLjVNQilcclxuICB9XHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd2QsU0FBUyxlQUFlLFdBQVc7QUFFM2YsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sWUFBWTtBQUNuQixPQUFPLHNCQUFzQjtBQUxzUSxJQUFNLDJDQUEyQztBQVFwVixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxJQUFJO0FBQUEsSUFDSixPQUFPO0FBQUEsSUFDUCxpQkFBaUI7QUFBQSxNQUNmLGdCQUFnQjtBQUFBLElBQ2xCLENBQUM7QUFBQSxFQUVIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLE1BQ3BELEtBQUs7QUFBQSxJQUNQO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLG1CQUFPO0FBQUEsVUFDVDtBQUNBLGNBQUksR0FBRyxTQUFTLGFBQWEsR0FBRztBQUM5QixtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyxrQkFBa0IsR0FBRztBQUNuQyxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLHVCQUF1QjtBQUFBO0FBQUEsRUFDekI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
