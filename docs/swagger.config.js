import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'TypeRush API',
            version: '1.0.0',
            description: 'Backend API for TypeRush typing practice and contests',
        },
        servers: [{ url: '/api', description: 'Local/dev' }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
    },
    apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};
const swaggerSpec = swaggerJsdoc(options);
export function setupSwagger(app) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'TypeRush API Docs',
        swaggerOptions: { persistAuthorization: true },
    }));
}
//# sourceMappingURL=swagger.config.js.map