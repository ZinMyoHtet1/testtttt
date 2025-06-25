// ${API}?lat=${lat}&lon=${lon}&appid=${ID}&units=
// https://openweathermap.org/img/wn/10d@2x.png
import { API, ID, ICON } from "./config.js";
import { ajax } from "./helper.js";
if (navigator.geolocation) {
  const dataObject = navigator.geolocation.getCurrentPosition(async function (
    position
  ) {
    const { latitude: lat, longitude: lon } = position.coords;
    const data = await ajax(
      `${API}?lat=${lat}&lon=${lon}&appid=${ID}&units=metric`
    );
    const dataObject = {
      city: data.name,
      temp: data.main.temp,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
    };
    console.log(dataObject);
    const markup = `
    <div class="top">
        <div class="city">${dataObject.city}</div>
        <div class="temperature">${dataObject.temp}&#8451;</div>
    </div>
    <img
    src="${ICON}/${dataObject.icon}@2x.png"
    alt="icon"
    />
    <div class="description">${dataObject.description}</div>
    `;
    document
      .querySelector(".container")
      .insertAdjacentHTML("afterbegin", markup);
  });
}
