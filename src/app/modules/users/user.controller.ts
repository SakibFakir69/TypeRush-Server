import type { Response,Request, NextFunction } from "express";





const createUser = (req:Request , res:Response,next:NextFunction)=>{

    try {
        
        
    } catch (error) {
        next(error);
        
    }
    
};


const updateUser = ()=>{};
const deleteUser = ()=>{}
const getUser    = ()=>{};












export const userController = {
    createUser,deleteUser,getUser,updateUser

}