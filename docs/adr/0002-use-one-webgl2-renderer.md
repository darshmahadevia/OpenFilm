# Use one WebGL2 renderer

OpenFilm uses one WebGL2 fragment-shader pipeline for preview and export semantics. Supporting WebGPU, WebGL2, and CPU renderers would multiply the testing and graphics work without improving the portfolio story enough to justify it. Browsers without WebGL2 receive a clear unsupported-device message.
