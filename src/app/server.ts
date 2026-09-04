
import { setupSwagger } from "../../docs/swagger.config.js";
import { mainServerApp } from "./index.js";


if (!process.env.PORT) {
    throw new Error("Please provide port number")
}
const PORT = process.env.PORT as unknown as number;


// RUN SERVER HERE
(() => {


    try {
        mainServerApp.listen(PORT, () => {
            // SETUP SWAGGER UI
            setupSwagger(mainServerApp);
            console.log(` [ SERVER RUNNING ON THIS PORT ] :  ${PORT}`)

        })

    } catch (error) {
        console.log(error)

    }

})()