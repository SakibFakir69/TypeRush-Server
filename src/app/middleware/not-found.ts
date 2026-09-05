import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";




export const notFound = (req:Request,res:Response)=>{

  return   res.status(StatusCodes.NOT_FOUND).json({
        route:`Not Found This path  [ ${req.url}  ] in project`
    })

}
