// const position = navigator.geolocation.getCurrentPosition(
//   (position) => position
// );
// console.log(position);

export const ajax = async function (url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (error) {
    console.log(error);
  }
};
// const result = await ajax();
// console.log(result);
