const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PassRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

function ValidEmail(email) {
  return typeof email === "string" && emailRegex.test(email);
}
function ValidUserName(Username) {
  return typeof Username === "string" && Username.length >= 5 && Username.length <= 16;
}
function ValidPassword(password) {
  return typeof password === "string" && PassRegex.test(password) && password.length >= 8;
}

export { ValidEmail, ValidPassword, ValidUserName };
