import "./styles.css";
import { useState, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  get,
  child,
  update,
  increment,
  onValue,
} from "firebase/database";
import { useTimer } from "react-timer-hook";
import config from "./config.json";

const firebaseConfig = config;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
//const analytics = getAnalytics(app);

const colors = [
  "#FFFFFF",
  "#E4E4E4",
  "#888888",
  "#222222",
  "#FFA7D1",
  "#E50000",
  "#E59500",
  "#A06A42",
  "#E5D900",
  "#94E044",
  "#02BE01",
  "#00D3DD",
  "#0083C7",
  "#0000EA",
  "#CF6EE4",
  "#820080",
];

export default function App() {
  const [zoomState, setZoomState] = useState({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });
  const [user, setUser] = useState(null);
  const [ip, setIp] = useState("");
  const [palleteShown, setPalleteShown] = useState(false);
  const [prevColor, setPrevColor] = useState(null);
  const [selected, setSelected] = useState({ x: 0, y: 0 });
  const [activePixel, setActivePixel] = useState({});

  const {
    seconds,
    minutes,
    hours,
    days,
    isRunning,
    start,
    pause,
    resume,
    restart,
  } = useTimer(0);

  useEffect(() => {
    const canvas = document.getElementById("canvas");

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 100, 100);

    const starCountRef = ref(db, "pixels/");
    onValue(starCountRef, (snapshot) => {
      const data = snapshot.val() ?? {};
      Object.keys(data).forEach((el) => {
        ctx.fillStyle = data[el]?.color;
        ctx.fillRect(
          10 * (el - 10 * parseInt(el / 10)),
          10 * parseInt(el / 10),
          10,
          10
        );
      });
    });
  }, []);

  useEffect(() => {
    update(ref(db, "currentUsers"), {
      num: increment(1),
    });

    window.addEventListener("beforeunload", function (e) {
      update(ref(db, "currentUsers"), {
        num: increment(-1),
      });
    });
  }, []);

  useEffect(() => {
    fetch("https://api.ipify.org?format=jsonp&callback=storeIp")
      .then((response) => response.text())
      .then((responseTxt) => {
        eval(responseTxt);
      });

    if (!user) {
      let u = localStorage.getItem("user");
      if (u) setUser(u);
      else {
        let inp = prompt("Write a User Name");
        if (inp) {
          localStorage.setItem("user", inp.substring(0, 20));
          setUser(inp);
        } else {
          localStorage.setItem("user", "Anonymous");
          setUser("Anonymous");
        }
      }
    }
  }, [user]);

  useEffect(() => {
    if (selected) {
      get(child(ref(db), "pixels/" + (selected.x + selected.y * 10))).then(
        (snapshot) => {
          if (snapshot.exists()) {
            setActivePixel(snapshot.val());
          } else {
            setActivePixel({});
          }
        }
      );
    }
  }, [selected]);

  function storeIp(addr) {
    setIp(addr.ip);

    get(child(ref(db), "waiting/" + addr.ip.replaceAll(".", " "))).then(
      (snapshot) => {
        if (snapshot.exists()) {
          if (snapshot.val() > +new Date()) {
            const time = new Date(snapshot.val());
            restart(time);
          } else {
            pause();
          }
        } else {
          pause();
        }
      }
    );
  }

  const pann = (ReactZoomPanPinchRef, event) => {
    setZoomState({
      offsetX: ReactZoomPanPinchRef.state.positionX,
      offsetY: ReactZoomPanPinchRef.state.positionY,
      scale: ReactZoomPanPinchRef.state.scale,
    });
  };

  const zoom = (ReactZoomPanPinchRef, event) => {
    setZoomState({
      offsetX: ReactZoomPanPinchRef.state.positionX,
      offsetY: ReactZoomPanPinchRef.state.positionY,
      scale: ReactZoomPanPinchRef.state.scale,
    });
  };

  function getCursorPosition(event) {
    const canvas = document.getElementById("canvas");

    const rect = canvas.getBoundingClientRect();

    const nx = event.clientX - rect.left;
    const ny = event.clientY - rect.top;

    let scale = zoomState?.scale ?? 1;
    let x = Math.floor(nx / (10 * scale));
    let y = Math.floor(ny / (10 * scale));

    const ctx = canvas.getContext("2d");

    if (prevColor) {
      ctx.fillStyle = prevColor;
      ctx.fillRect(selected.x * 10, selected.y * 10, 10, 10);
    }

    let prevColorData = ctx.getImageData(x * 10, y * 10, 1, 1).data;
    setPrevColor(
      "rgb(" +
        prevColorData[0] +
        ", " +
        prevColorData[1] +
        ", " +
        prevColorData[2] +
        ")"
    );

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "white";
    ctx.fillRect(x * 10, y * 10, 10, 10);
    ctx.globalAlpha = 1;

    setPalleteShown(true);

    return { x, y };
  }

  const updateSelected = (i) => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = i;
    ctx.fillRect(selected.x * 10, selected.y * 10, 10, 10);
  };

  const setColor = () => {
    if (user) {
      get(child(ref(db), "waiting/" + ip.replaceAll(".", " "))).then(
        (snapshot) => {
          if (snapshot.exists()) {
            if (snapshot.val() > +new Date()) {
              console.log("Please wait to place next pixel");
            } else {
              updateDB();
            }
          } else {
            updateDB();
          }
        }
      );
    }
  };

  const updateDB = () => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    let colorData = ctx.getImageData(
      selected.x * 10,
      selected.y * 10,
      1,
      1
    ).data;
    let color =
      "rgb(" + colorData[0] + ", " + colorData[1] + ", " + colorData[2] + ")";

    let time = +new Date();

    set(ref(db, "pixels/" + (selected.y * 10 + selected.x)), {
      color,
      user,
      ip,
      time,
    });

    set(ref(db, "waiting/" + ip.replaceAll(".", " ")), +new Date() + 60 * 1000);

    setPrevColor(null);
    setPalleteShown(false);

    const t = new Date();
    t.setSeconds(t.getSeconds() + 60);
    restart(t);
  };

  const handleClicks = (e) => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    if (e.target.id === "wrapper") {
      setPalleteShown(false);
      setActivePixel({});
      if (prevColor) {
        ctx.fillStyle = prevColor;
        ctx.fillRect(selected.x * 10, selected.y * 10, 10, 10);
      }
    }
  };

  function timeAgo(value) {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(value).getTime()) / 1000
    );
    let interval = seconds / 31536000;

    if (interval > 1) {
      return Math.floor(interval) + "y";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + "m";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + "d";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + "h";
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + "min";
    }
    return Math.floor(interval) + "s";
  }

  return (
    <div className="App" onClick={handleClicks}>
      <TransformWrapper
        style={{
          height: "100vh",
          width: "100vw",
        }}
        onZoom={zoom}
        onPanning={pann}
        maxScale={5}
        minScale={0.3}
      >
        <TransformComponent>
          <div
            style={{
              height: "100vh",
              width: "100vw",
            }}
            id="wrapper"
          >
            <canvas
              id="canvas"
              className="canvas tooltip"
              height="100px"
              width="100px"
              onMouseDown={(e) => setSelected(getCursorPosition(e))}
            ></canvas>
          </div>
        </TransformComponent>
      </TransformWrapper>
      {palleteShown ? (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            alignSelf: "center",
            background: "#ff4500",
            minWidth: 200,
            width: "60vw",
            left: "20vw",
            zIndex: 5,
            paddingBottom: 10,
            paddingTop: 0,
            paddingLeft: 20,
            paddingRight: 20,
            borderRadius: 20,
            border: "2px solid #FF4500",
          }}
          id="pallete"
        >
          <details>
            <summary
              style={{
                fontSize: 12,
                marginBottom: 6,
                marginTop: 6,
                textAlign: "left",
                cursor: "pointer",
                textDecoration: "underline",
                color: "#FFF",
              }}
            >
              More
            </summary>
            <p
              style={{
                fontSize: 12,
                marginBottom: 15,
                marginTop: 5,
                textAlign: "left",
                color: "#fff",
              }}
            >
              Placed by <b>{activePixel?.user}</b>{" "}
              {activePixel?.time ? timeAgo(activePixel?.time) + " ago" : null}
            </p>
          </details>

          <div className="pallete-colors">
            {colors.map((i, v) => (
              <div
                key={i + v}
                style={{
                  background: i,
                  borderRadius: 20,
                  marginRight: 10,
                }}
                className="colors"
                onClick={() => updateSelected(i)}
              >
                <div
                  style={{
                    width: 20,
                  }}
                ></div>
              </div>
            ))}
          </div>

          <button
            onClick={isRunning ? null : setColor}
            style={{
              position: "absolute",
              right: 15,
              top: "30%",
              padding: 7,
              paddingRight: 12,
              paddingLeft: 12,
              border: "none",
              borderRadius: 15,
              backgroundColor: "#FFF",
              color: "black",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            {isRunning ? minutes + ":" + seconds : "Place"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
