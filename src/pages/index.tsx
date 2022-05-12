import Head from 'next/head'
import { useCallback, useEffect, useRef, useState, FormEvent } from 'react'
import { createFFmpeg, fetchFile, FFmpeg } from "@ffmpeg/ffmpeg";

function fname(file: File): string {
  if (file.name.indexOf('.') === -1) {
    return file.name;
  }

  const ext = file.name.slice(file.name.indexOf('.'));
  return `input${ext}`;
}

export default function Home() {
  const [state, setState] = useState<"initial"|"processing"|"done"|"error">("initial");
  const [progress, setProgress] = useState<number|undefined>();
  const pre = useRef<HTMLPreElement>(null);

  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  useEffect(() => {
    const ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
      logger({type, message}) {
        if (!pre.current) {
          return;
        }
        pre.current.append(`[${type}] ${message}\n`);
      },
      progress({ratio}) {
        setProgress(ratio);
      },
    });

    (async () => {
      await ffmpeg.load();
      setFfmpeg(ffmpeg);
    })();

    return () => {
      if (ffmpeg.isLoaded()) {
        ffmpeg.exit();
      }
      setFfmpeg(null);
      setProgress(void 0);
    }
  }, [setFfmpeg, pre, setProgress]);

  const [src, setSrc] = useState<string | undefined>();
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (!file || !ffmpeg) {
      return;
    }

    (async () => {
      setState("processing");
      try {
        const name = fname(file);
        ffmpeg.FS('writeFile', name, await fetchFile(file));
        //await ffmpeg.run('-i', name, '-r', '10', 'output.gif');
        await ffmpeg.run('-i', name, '-filter_complex', '[0:v] fps=10,scale=640:-1,split [a][b];[a] palettegen [p];[b][p] paletteuse=dither=floyd_steinberg', 'output.gif');
        const data = ffmpeg.FS('readFile', 'output.gif');
        setSrc(URL.createObjectURL(new Blob([data.buffer], { type: 'image/gif' })));
        setState("done");
      } catch (e) {
        setState("error");
        throw e;
      }

    })();
  }, [setSrc, ffmpeg, file, setState]);

  const handler = useCallback((evt: FormEvent<HTMLInputElement>): any => {
    const file = evt.currentTarget.files?.[0];
    if (typeof file === "undefined") {
      return void setFile(null);
    }
    setFile(file);
  }, [setFile]);

  return (
    <div>
      <Head>
        <title>intogif</title>
        <meta name="description" content="Generated by create next app" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>🎥</text></svg>"
        />
      </Head>

      <main>
        {state !== "done" ? <>
          <input type="file" onInput={handler} accept="video/*"/>
          { typeof progress !== "undefined" ? <progress value={progress} /> : null }
          <pre ref={pre}></pre>
        </> : null }
        {state === "error" ? <div>ERROR OCCURRED.</div> : null }
        <img src={src}/>
      </main>
    </div>
  )
}
