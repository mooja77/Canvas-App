import { useState } from 'react';
import type { TrainingVideo } from '../../data/trainingVideos';

interface YouTubeVideoCardProps {
  video: TrainingVideo;
  featured?: boolean;
}

export function YouTubeVideoCard({ video, featured = false }: YouTubeVideoCardProps) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const watchUrl = video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950 ${featured ? 'lg:grid lg:grid-cols-[1.35fr_1fr]' : ''}`}
    >
      <div className="relative aspect-video bg-slate-950">
        {playerLoaded && video.videoId ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0`}
            title={`${video.shortTitle} video player`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : video.videoId ? (
          <button
            type="button"
            className="group absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={() => setPlayerLoaded(true)}
            aria-label={`Play ${video.shortTitle}. This connects to YouTube.`}
          >
            <img className="h-full w-full object-cover" src={video.thumbnail} alt="" loading="lazy" />
            <span className="absolute inset-0 bg-slate-950/10 transition-colors group-hover:bg-slate-950/20" />
            <span className="absolute left-1/2 top-1/2 grid h-16 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-amber-500 text-slate-950 shadow-xl transition-transform group-hover:scale-105">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        ) : (
          <div className="absolute inset-0">
            <img className="h-full w-full object-cover opacity-75" src={video.thumbnail} alt="" loading="lazy" />
            <div className="absolute inset-0 grid place-items-center bg-slate-950/50">
              <span className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-900" role="status">
                Publishing shortly
              </span>
            </div>
          </div>
        )}
        <span className="absolute bottom-3 right-3 rounded bg-slate-950/85 px-2 py-1 text-xs font-semibold text-white">
          {video.duration}
        </span>
      </div>

      <div className="flex flex-col p-5 sm:p-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
          {video.category}
        </p>
        <h3 className="text-xl font-semibold leading-snug text-gray-950 dark:text-white">{video.shortTitle}</h3>
        <p className="mt-3 flex-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{video.outcome}</p>
        {watchUrl && (
          <a
            className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
          >
            Watch directly on YouTube
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  );
}
