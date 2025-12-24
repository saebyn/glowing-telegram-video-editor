function usePreloadImages(imageUrls: string[]) {
  imageUrls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

export default usePreloadImages;
