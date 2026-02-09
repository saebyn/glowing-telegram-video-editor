import { useEffect } from "react";

function usePreloadImages(imageUrls: string[]) {
  useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) {
      return;
    }

    const images: HTMLImageElement[] = [];

    for (const url of imageUrls) {
      const img = new Image();
      img.src = url;
      images.push(img);
    }

    return () => {
      for (const img of images) {
        img.src = "";
      }
    };
  }, [imageUrls]);
}

export default usePreloadImages;
