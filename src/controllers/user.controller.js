import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/APIerror.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/APIresponse.js";

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const refreshToken= user.generateRefreshToken()
        const accessToken= user.generateAccessToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false}) 

        return { accessToken, refreshToken}
    
    } catch (error) {
        console.log("REAL ERROR in generateAccessAndRefreshToken: ", error);
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}
const registerUser = asyncHandler(async(req,res)=>{
    // get user details from frontend
    // Validation- not empty 
    //Check if user already exists : username, email
    // Check for images , check for avatar
    // Upload them to cloudinary,avatar
    // create user object - create entry in db
    // remove password and refresh token field from response 
    // check for user creation 
    // return response 



    const {fullName, email, username, password}=req.body
    console.log("email:", email);

    if (
        [fullName,email,username,password].some((field)=>
        field?.trim() === "")
    ) {
        throw new ApiError(400,"All Fields are required")
    }


    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exist ")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
        coverImageLocalPath = req.files.coverImage[0].path
        
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar =await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()

    })
    const createdUser=  await User.findById(user._id).select(
        "-password -refreshToken"

    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while selecting a user ")

    }

    return res.status(201).json(
        new ApiResponse(200, createdUser,"User Registered Successfully")
    )



}  )

 const loginUser = asyncHandler(async(req,res)=>{
    // req body -> data
    // username or email
    // Find the user 
    // Password Check 
    // Access and refresh token 
    // Send Cookie 


    const {email,username,password} = req.body

    if (!(username || email)) {
        throw new ApiError(400,"username or email is required")

        
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if (!user) {
        throw new ApiError(404,"User does not exist")
        
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

        if (!isPasswordValid) {
        throw new ApiError(404,"Invalid user credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200).cookie("accessToken", accessToken, options)
    .cookie("refreshToken" , refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: LoggedInUser,accessToken,
                refreshToken
            },
            "User logged in successfully"
            
        )

    )


 })

const logoutUser = asyncHandler(async(req,res)=>{
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set :{
                refreshToken: undefined
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly: true,
        secure : true
    }
    return res.status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "User Logged out"))
})

export {
    registerUser ,
    loginUser,
    logoutUser

}
