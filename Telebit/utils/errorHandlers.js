const CustomError = require("./CustomError.js");

exports.castErrorHandler = (err) => {
  const msg = `Invalid value for field ${err.path}: ${err.value}`;
  return new CustomError(msg, 400);
};

exports.duplicateKeyErrorHandler = (err) => {
  const msg = `There already had phone name. Please try another name`;
  return new CustomError(msg, 400);
};

exports.validationErrorHandler = (err) => {
  const contents = Object.values(err.errors)
    .map((val) => val)
    .join(". ");
  const msg = `Validation Failed: ${contents}`;
  return new CustomError(msg, 400);
};

exports.referenceErrorHandler = (err) => {
  const msg = `ReferenceError : ${err.message}`;
  return new CustomError(msg, 400);
};

exports.mongooseErrorHandler = (err) => {
  const msg = `MongooseError : ${err.message}`;
  return new CustomError(msg, 400);
};

exports.typeErrorHandler = (err) => {
  const msg = `TypeError : ${err.message}`;
  return new CustomError(msg, 400);
};
