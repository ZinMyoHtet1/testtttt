const {
  castErrorHandler,
  duplicateKeyErrorHandler,
  validationErrorHandler,
  referenceErrorHandler,
  mongooseErrorHandler,
  typeErrorHandler,
} = require("./errorHandlers.js");

function devError(res, error) {
  console.log(error?.name);
  console.log(error);
  res.status(error.statusCode).json({
    status: error.status,
    message: error.message,
    stackTrace: error.stack,
    error: error,
  });
}

function proError(res, error) {
  if (error.isOperational) {
    res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  } else {
    res.status(500).json({
      status: "error",
      message: "Something went wrong! Try again later.",
    });
  }
}

const globalErrorHandler = function (error, req, res, next) {
  console.log(error, "global");
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";

  if (process.env.MODE === "development") {
    console.log(error);
    devError(res, error);
  } else if (process.env.MODE === "production") {
    if (error?.name === "CastError") error = castErrorHandler(error);

    if (error?.errorResponse?.code === 11000)
      error = duplicateKeyErrorHandler(error);

    console.log(error?.name);

    if (error?.name === "ValidationError")
      error = validationErrorHandler(error);
    if (error?.name === "ReferenceError") error = referenceErrorHandler(error);
    if (error?.name === "MongooseError") error = mongooseErrorHandler(error);
    if (error?.name === "TypeError") error = typeErrorHandler(error);

    proError(res, error);
  }
};

module.exports = globalErrorHandler;
