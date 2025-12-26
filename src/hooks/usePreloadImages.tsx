function usePreloadImages(imageUrls: string[]) {
  for (const url of imageUrls) {
    const img = new Image();
    img.src = url;
  }
}

export default usePreloadImages;
