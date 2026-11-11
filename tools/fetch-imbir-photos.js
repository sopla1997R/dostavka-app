// Downloads Imbir's own dish photos from their Tilda site (imbir-lensk.ru), resized by Tilda's CDN.
// Saves to clients/imbir/img/<productId>.webp
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "clients", "imbir", "img");
fs.mkdirSync(dir, { recursive: true });

const MAP = {
  s1: "tild3832-3063-4534-a632-313837323462/photo_2024-10-17_08-.jpg",
  s2: "tild3838-3239-4437-b064-326634353236/C06EDEBB-F36F-418F-9.jpeg",
  s3: "tild6262-6363-4232-b636-383134666439/photo_2024-10-17_08-.jpg",
  s4: "tild6262-6263-4266-b233-643636333235/photo_2024-10-17_08-.jpg",
  s5: "tild3665-3039-4235-a363-646431616430/photo_2024-10-17_08-.jpg",
  s6: "tild6136-3365-4133-b130-316261393861/photo_2024-10-17_08-.jpg",
  s7: "tild6432-3639-4266-b938-613263633661/photo_2024-10-17_08-.jpg",
  s8: "tild6532-3834-4832-b663-373035376537/photo_2024-10-17_08-.jpg",
  s9: "tild3563-3365-4337-b161-656230383665/photo_2024-10-17_08-.jpg",
  s10: "tild3137-6431-4061-a435-393565303534/photo_2024-10-17_08-.jpg",
  c1: "stor3738-3435-4566-b262-366466336134/24120414.png",
  c2: "stor6531-3332-4938-b731-623030613936/75706187.png",
  c3: "stor6334-3038-4165-b363-353861666232/70661182.png",
  c4: "stor3034-3031-4031-a561-653861303933/20332174.png",
  c5: "stor3235-6239-4637-a564-363163353039/43682350.png",
  c6: "stor3733-3539-4838-b533-633964633634/46124222.png",
  c7: "stor3366-3663-4537-b735-383062333737/4426db205a412860f0b2d4862cf5e162.jpg",
  c8: "stor3236-3330-4366-b363-326662343238/81508392.png",
  c9: "stor6564-3466-4030-a332-373539623762/36697973.png",
  c10: "stor6664-3730-4662-b932-343964623737/71063731.png",
  c11: "stor3234-6332-4034-b066-323562373964/91292902.png",
  c12: "stor3732-6435-4231-b665-646366303862/64aebf4235d4ab9c6f5968dc90fdcdba.jpg",
  c13: "stor6232-3035-4434-b664-396662386665/0a352307fc955386e2ed2cd0b2cd1366.jpg",
  c14: "stor6136-6634-4437-a132-623835303065/9d51762593da02b886ed3b93465a02d5.jpg",
  b1: "stor6165-3162-4237-b335-363633653331/15822849.png",
  b2: "stor6134-3666-4963-b935-643165386237/31712730.png",
  b3: "stor3232-3736-4336-b265-613835333230/14008040.png",
  b4: "stor6362-6365-4334-b366-326565353733/e7e59454e61c3e2060d2ea43cf7166ef.jpg",
  b5: "stor3433-3031-4263-b261-636137383466/79555844.png",
  b6: "stor3638-3137-4561-a666-346436616533/63369792.png",
  b7: "stor3136-3364-4734-b432-363730633737/30941601.png",
  b8: "stor6562-3839-4862-a437-663832636138/65788146.png",
  b9: "stor3330-6332-4265-a535-306565613064/92896140.png",
  f1: "stor3865-6430-4639-a664-363364393066/76728519.png",
  f2: "stor3738-3635-4565-b865-346234633961/67160022.png",
  f3: "stor6332-3265-4561-b731-306262616162/35008715.png",
  f4: "stor3638-3630-4462-a330-616531396430/604d55557ed213801b17ac4f0a28deaa.jpg",
  f5: "stor6537-3836-4230-b433-373239373131/33553948.png",
  f6: "stor6662-3535-4336-a335-643963653830/51487537.png",
  k1: "stor3663-6335-4036-b564-336664316136/63084071.png",
  k2: "stor3635-3537-4066-a537-346264316462/32623536.png",
  k3: "stor3066-6564-4662-a433-386532376265/42381495.png",
  k4: "stor3936-3662-4437-b564-303034316663/61072749.png",
  k5: "stor3639-3538-4338-a663-616331326133/27575552.png",
  g1: "stor3237-3664-4730-b830-363134643635/94788344.png",
  g2: "stor3863-6534-4231-a233-386264363761/67012402.png",
  g3: "stor3031-3066-4361-a261-333966303535/67422118.png",
  g4: "stor3261-6134-4631-a263-326563396162/76680934.png",
  g5: "stor6436-6537-4337-a337-636237336339/84659749.png",
  g6: "stor6335-3932-4765-a362-616664306636/68798691.png",
  z1: "tild3931-6232-4538-a235-333639303736/1iqyv0fmzet5e8wxr29u.png",
  z2: "tild3932-6133-4537-a138-633138343738/IMG_4168.PNG",
  z3: "tild3430-3265-4964-b836-653937336537/photo.jpeg",
  z4: "tild6639-3762-4338-b362-373661313036/_.png",
  z5: "tild6134-3665-4264-b939-626334326638/uuiok7ul7nzyqzsz7aph.png",
  z6: "tild3437-6264-4737-b063-336138386539/photo.png",
  z7: "tild6634-6234-4830-b933-326535336265/lg0kf5gms1nb6gjhpf4r.png",
  z8: "tild6361-3135-4434-b333-346266626362/_.jpg",
  z9: "tild6333-6332-4838-b435-386437383131/photo.jpg",
  w1: "stor6362-3634-4531-a436-393963306561/31130882.png",
  w2: "stor6139-6532-4030-b735-663262613232/38161826.png",
  w3: "stor3235-3763-4233-b264-623539636439/32010880.png",
  w4: "stor6631-3430-4737-a637-636663383236/74368342.png",
  w5: "stor3838-6464-4262-b561-396536353839/27697337.png",
  w6: "stor3731-3730-4465-b538-376666353632/19129297.png",
  w7: "stor6262-6531-4431-b266-343365353865/89408080.webp",
  w8: "stor3436-6535-4034-a331-306231393336/96016130.png",
  a1: "tild3134-6166-4331-b164-303837333430/photo_2024-10-20_16-.jpg",
  a2: "tild3364-3736-4931-a165-643232346231/photo_2024-10-20_16-.jpg",
  a3: "tild3634-3335-4237-b237-323461346439/photo_2024-10-20_16-.jpg",
  a4: "tild3065-3835-4361-b232-323163383735/photo_2024-10-20_16-.jpg",
  a5: "tild6561-6135-4565-a337-656432373136/photo_2024-10-20_16-.jpg",
  a6: "tild3064-3562-4565-a530-396539303664/photo.avif"
};

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status + " " + url);
  const type = r.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error("not an image: " + type);
  return { buf: Buffer.from(await r.arrayBuffer()), type };
}

(async () => {
  let ok = 0, total = 0;
  for (const [id, p] of Object.entries(MAP)) {
    const [d, f] = p.split("/");
    const tries = [
      `https://thb.tildacdn.com/${d}/-/resize/720x/-/format/webp/${f}`,
      `https://static.tildacdn.com/${d}/${f}`
    ];
    for (const url of tries) {
      try {
        const { buf, type } = await get(url);
        const ext = type.includes("webp") ? "webp" : type.includes("png") ? "png" : type.includes("avif") ? "avif" : "jpg";
        fs.writeFileSync(path.join(dir, id + "." + ext), buf);
        total += buf.length; ok++;
        console.log(id, ext, Math.round(buf.length / 1024) + " KB");
        break;
      } catch (e) { console.log(id, "fail", e.message); }
    }
  }
  console.log(`done: ${ok}/${Object.keys(MAP).length}, ${Math.round(total / 1024)} KB total`);
})();
