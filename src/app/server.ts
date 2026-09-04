
import { mainServerApp } from "./index.js";

if(!process.env.PORT){
    throw new Error("Please provide port number")
}
const PORT=process.env.PORT as unknown as number;


// RUN SERVER HERE
(()=>{


    try {
        mainServerApp.listen(PORT,()=>{
            console.log(` [ SERVER RUNNING ON THIS PORT ] :  ${PORT}`)

        })
        
    } catch (error) {
        console.log(error)
        
    }

})()