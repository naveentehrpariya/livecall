const JSONerror = (res, err, next) => {
  if (err.name === 'ValidationError') {
    const formattedErrors = Object.keys(err.errors).map((key) => {
      return {
        field: key,
        message: err.errors[key].message,
        kind: err.errors[key].kind,
        value: err.errors[key].value,
      };
    });

    return res.status(400).json({
      status: false,
      message: "Validation Error",
      errors: formattedErrors,
    });
  }

  // Optional: Handle other errors like duplicate keys, etc.
  if (err.code === 11000) {
    return res.status(400).json({
      status: false,
      message: "Duplicate field value",
      errors: [err.keyValue],
    });
  }

  return res.status(500).json({
    status: false,
    message: "Internal Server Error",
    errors: [err.message || "Unknown error"],
  });
};

module.exports = JSONerror;
