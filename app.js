const routeLinks = [...document.querySelectorAll("[data-route]")];
const pages = [...document.querySelectorAll("[data-page]")];
const lockers = [...document.querySelectorAll("[data-locker]")];

function showRoute(name) {
  const target = pages.some((page) => page.dataset.page === name) ? name : "main";

  pages.forEach((page) => {
    const active = page.dataset.page === target;
    page.hidden = !active;
    page.classList.toggle("active", active);
  });

  routeLinks.forEach((link) => {
    const active = link.dataset.route === target;
    link.classList.toggle("active", active);
    if (link.closest("nav")) link.setAttribute("aria-current", active ? "page" : "false");
  });

  document.title = target === "museum" ? "THE MUSEUM — Club History" : "THE NEXT ERA";
  document.body.dataset.route = target;
}

window.addEventListener("hashchange", () => showRoute(location.hash.slice(1)));
showRoute(location.hash.slice(1));

lockers.forEach((locker) => {
  const trigger = locker.querySelector(".locker-trigger");
  const record = locker.querySelector(".locker-record");

  trigger.addEventListener("click", () => {
    const opening = !locker.classList.contains("is-lit");

    lockers.forEach((item) => {
      item.classList.remove("is-lit");
      item.querySelector(".locker-trigger").setAttribute("aria-expanded", "false");
      item.querySelector(".locker-record").setAttribute("aria-hidden", "true");
    });

    if (opening) {
      locker.classList.add("is-lit");
      trigger.setAttribute("aria-expanded", "true");
      record.setAttribute("aria-hidden", "false");
    }
  });
});
