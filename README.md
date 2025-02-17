# url-shortener-worker

Yet another url shortener based on Cloudflare Workers and Cloudflare KV.

## Features

* **Two Redirect Methods (Configurable)**: Supports both **HTML redirect** and **HTTP 302 redirect**. Choose between them by setting the `HTML_REDIRECT` environment variable.
	* **HTML Redirect**: Uses a simple HTML page with JavaScript to redirect the user (also shows a link on the page as a fallback when JavaScript is disabled). This method might be preferred in some scenarios for compatibility or tracking purposes.
	* **HTTP 302 Redirect**:  Performs a standard HTTP 302 Found redirect. This is generally faster and SEO-friendly.
* **Customizable Default URL**: Define a default URL to redirect to when the short path is empty or not found, using the `DEFAULT_URL` environment variable.
* **Secure API for Shortlink Creation**:  Provides a protected API endpoint (POST) to create short URLs, secured by an API token (`API_TOKEN`).
* **No Confusing Charset**: Ultilizes a carefully selected character set (`ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678`) to exclude characters that are easily confused (like `oO0`, `1lI`).

## Configure

* **`KV_NAMESPACE_BINDING`**: *(Required)* The binding name you will use in your Worker code. Set it in the `wrangler.toml` or via the Dashbaord.
* **`KV_NAMESPACE_ID`**: *(Required)* The ID of your Cloudflare KV namespace. Find it in the Dashboard.
* **`DEFAULT_URL`**: *(Required)* The default URL to redirect to when a short path is not found in KV, or when accessing the root path of the short link service.
* **`HTML_REDIRECT`**: *(Optional)* A boolean value to determine the redirect method. Set to `true` to use HTML redirect. TOML or JSON configuration formats do support boolean type varialbes, and if you have to configure them via the Dashboard, make sure you choose the `JSON` type for the variable.
* **`API_TOKEN`**: *(Required for POST requests)* A secret token used to authorize POST requests to create short URLs.

**Example `wrangler.toml` configuration:**

```toml
name = "<your-service-name>"
main = "src/index.ts"
compatibility_date = "2025-02-14"

[observability]
enabled = true

[[kv_namespaces]]
binding = "KV_NAMESPACE_BINDING"
id = "<kv-namespace-id>"

[vars]
DEFAULT_URL = "<default-redirect-url>"
HTML_REDIRECT = true # Optional: Set to true for HTML redirect, remove or set to false for 302 redirect
```

**Note**: It's highly recommended to manage sensitive environment variables like `API_TOKEN` as secrets by `wrangler secret` or via Cloudflare Dashboard for enhanced security.

## Deployment

1. **Prerequisites**:
	- Ensure you have a Cloudflare account.
	- Create a KV namespace in Cloudflare Dashboard

2. **Clone the repository**

3. **Configure the Worker**
	Update the `wrangler.toml` file with your settings.

4. **Deploy the Worker**
	Either use `wrangler deploy` or create a Worker in the Dashboard and then connect it to your GitHub repo.

5. **Configure the `API_TOKEN` secret**
	If you want to use the `POST` API to create new short links. You can always manage the KV pairs via the Dashboard though.

**Warning**: It's recommended to configure `kv_namespaces`, `DEFAULT_URL` and `HTML_REDIRECT` with `wrangler.toml`. If your worker is connected to your GitHub repo, configurations in `wrangler.toml` will **override** settings in Cloudflare Dashboard on every push (except for secrets like `API_TOKEN`). To avoid configuration issues, manage bindings and environment variables consistently in `wrangler.toml`.

## Usage

### Redirect with Short Links (GET)

Example:

Assuming your worker is deployed at `your-worker-domain.com`.

If a short path `xyz123` is associated with `https://www.example.com/long-target-url`.

Accessing `your-worker-domain.com/xyz123` will redirect you to `https://www.example.com/long-target-url`.

Accessing `your-worker-domain.com` (visit the root URL) will redirect you to the `DEFAULT_URL` you configured.

### Create Short Links (POST)

- **Method**: POST
- **Headers**:
	- Authorization: Bearer <YOUR_API_TOKEN>
	- Content-Type: application/json
- **Request Body (JSON)**:
	```json
	{
	  "url": "<URL_TO_SHORTEN>"
	}
	```
- **Example using curl**:
	```bash
	curl -X POST \
	  -H "Authorization: Bearer your-secret-api-token" \
	  -H "Content-Type: application/json" \
	  -d '{"url": "https://www.example.com/very/long/url/path"}' \
	  "https://your-worker-domain.com"
	```
- **Successful Response (Status 200 OK)**:
	```json
	{
	  "short": "https://your-worker-domain.com/shortPath",
	  "original": "https://www.example.com/very/long/url/path"
	}
	```
	The `short` field in the response contains the newly created short URL.
- **Error Responses**:
	- **400 Bad Request**: Empty or invalid JSON body, missing `url` field, or invalid URL format.
	- **401 Unauthorized**: Missing or invalid `Authorization` header or incorrect API token.
	- **500 Internal Server Error**: Unexpected errors during processing. Check worker logs for details.

## Customization

- **Redirect Type**: Switch between HTML and 302 redirect by modifying the `HTML_REDIRECT` environment variable.
- **HTML Redirect Page**: Modify the `HTML_REDIRECT_PAGE` function in `index.ts` to customize the html page.
- **Default URL**: Change the `DEFAULT_URL` environment variable to set a different default redirection target.
- **Short Path Length**: Adjust the length of random short paths by modifying the `generateRandomString` function (defaults to `6`).

## Reference

[Redirections in HTTP - HTTP | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections)

[HTTP response status codes - HTTP | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

[xyTom/Url-Shorten-Worker: A URL Shortener created using Cloudflare worker](https://github.com/xyTom/Url-Shorten-Worker)