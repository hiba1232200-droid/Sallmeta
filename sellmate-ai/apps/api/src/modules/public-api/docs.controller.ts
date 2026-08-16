import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { openapiSpec } from './openapi';

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SellMate AI — توثيق REST API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>body { margin: 0; } .topbar { display: none; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout',
        });
      };
    </script>
  </body>
</html>`;

/** توثيق الواجهة: مواصفة OpenAPI + واجهة Swagger UI تفاعلية (عامة). */
@Controller({ version: VERSION_NEUTRAL })
export class DocsController {
  @Public()
  @Get('openapi.json')
  spec() {
    return openapiSpec;
  }

  @Public()
  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  ui(): string {
    return SWAGGER_HTML;
  }
}
