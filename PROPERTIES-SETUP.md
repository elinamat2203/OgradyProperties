# Setting up your Properties page

Your website's Properties page and individual property pages pull their content
straight from a Google Sheet. Add a row to the sheet, and a new property
appears on the site automatically — no code editing required.

## 1. Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank sheet.
2. Import the included `properties-template.csv` file: **File > Import > Upload**,
   choose the file, and select "Replace current sheet."
3. This gives you the correct column headers plus three example rows you can
   edit or delete.

### The columns, explained

| Column | What to put in it | Example |
|---|---|---|
| `id` | A unique number or short code per property. Never reuse one. | `1`, `2`, `sligo-104` |
| `status` | Where the property is at | `For Sale`, `To Let`, `Sale Agreed`, `Let` |
| `title` | Short name shown on the card | `3 Bed Semi-Detached` |
| `address` | Full address | `Cartron Heights, Sligo` |
| `price` | Number or amount. You can just type digits — €is added automatically. | `295000` or `1,250 pcm` |
| `beds` | Number of bedrooms | `3` |
| `baths` | Number of bathrooms | `2` |
| `type` | Property type (used for the filter dropdown) | `House`, `Apartment`, `Bungalow` |
| `ber` | BER rating | `B2` |
| `floor_area` | Floor area | `110 sq.m` |
| `features` | Short bullet points, separated by a semicolon `;` | `Rear garden;Off-street parking` |
| `description` | The full write-up shown on the property's own page | A paragraph or two |
| `image1`–`image10` | Direct links or website-relative paths to photos (see below) | `https://...` or `lough-bo/image1.jpg` |
| `featured` | `yes` to show it on the homepage, `no` or blank otherwise | `yes` |

### About photos

Google Sheets can't host your images directly — you need a direct image URL
for each photo. The simplest options:

- Upload the photo to a free host like [imgbb.com](https://imgbb.com) or
  [postimages.org](https://postimages.org) and copy the "direct link" it gives you.
- Or use photos already hosted on your own website once it's live.

Leave `image1`–`image10` blank and the site will show a placeholder graphic
instead — so nothing breaks if you haven't got photos sorted yet. For local
website images, put the relative path in the sheet, such as
`lough-bo/image1.jpg`; the site resolves it from `assets/properties/`.

## 2. Publish the sheet as CSV

1. In your Google Sheet: **File > Share > Publish to web**.
2. Under "Link," choose the specific sheet (usually "Sheet1") and select
   **Comma-separated values (.csv)** as the format.
3. Click **Publish**, confirm, and copy the URL it gives you. It will look
   something like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-xxxxxxx/pub?output=csv`

## 3. Connect it to the site

1. Open `assets/properties-config.js` in a text editor.
2. Replace `PASTE_YOUR_PUBLISHED_GOOGLE_SHEET_CSV_LINK_HERE` with the URL you
   just copied, keeping the quote marks around it.
3. Save the file, re-upload it to your hosting (or ask Claude to update it
   for you), and the Properties page will start pulling live from your sheet.

## Day-to-day: adding a new property

Just add a new row to the sheet with a new, unused `id`. It will appear on
the Properties page (and the homepage, if marked `featured = yes`) usually
within a minute or two — Google's cache updates periodically.

To take a property down, either delete its row or change its `status` —
whichever you prefer.

## A couple of things worth knowing

- **Anyone with the published link can view your sheet's data as CSV** — don't
  put anything in it you wouldn't want public. That's fine for property
  listings, since they're meant to be public anyway.
- If a change doesn't show up straight away, Google's publish cache can take
  a few minutes to refresh — try again shortly.
