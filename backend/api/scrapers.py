import os
import time
from urllib.parse import urlparse
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

# --- 1. The Base Interface ---
class BaseScraper:
    def scrape(self, driver, url, **kwargs):
        raise NotImplementedError("Subclasses must implement the 'scrape' method")


# --- 2. Specific Site Scrapers ---
class GoogleFinanceScraper(BaseScraper):
    def scrape(self, driver, url, **kwargs):
        driver.get(url)
        try:
            price_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, '//div[contains(@class, "YMlKec fxKbKc")]'))
            )
            price = price_element.text
            
            name_element = driver.find_element(By.XPATH, '//div[contains(@class, "zzDege")]')
            name = name_element.text
            
            return {
                "source": "Google Finance",
                "stock_name": name,
                "price": price,
                "url": url
            }
        except Exception as e:
            return {"error": f"Failed to parse Google Finance: {str(e)}"}


class CSCSScraper:
    """A modular scraper designed to be orchestrated by a task manager."""
    
    def login_and_navigate(self, driver, url):
        """Establishes the session and gets to the data page."""
        username = os.getenv('CSCS_USERNAME')
        password = os.getenv('CSCS_PASSWORD')

        if not username or not password:
            raise ValueError("Credentials missing in .env file.")

        driver.get(url)
        user_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.NAME, "username"))
        )
        pass_input = driver.find_element(By.NAME, "password") 
        login_btn = driver.find_element(By.NAME, "Go")

        user_input.send_keys(username)
        pass_input.send_keys(password)
        login_btn.click()

        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//a[contains(text(), 'Logout')]")) 
        )

        history_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[@href='pricelisthistory']"))
        )
        history_link.click()
        
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "symbols"))
        )

    def extract_available_symbols(self, driver):
        """Reads the dropdown once and returns a sorted list of all valid options."""
        select_element = driver.find_element(By.ID, "symbols")
        select = Select(select_element)
        values = [opt.get_attribute("value").strip() for opt in select.options if opt.get_attribute("value").strip()]
        values.sort() # Alphabetize
        return values

    def scrape_single_symbol(self, driver, symbol):
        """Executes the JS extraction for one specific target."""
        current_select_element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "symbols"))
        )
        current_select = Select(current_select_element)
        current_select.select_by_value(symbol)

        display_btn = driver.find_element(By.XPATH, "//input[@value='Display']")
        display_btn.click()

        # Buffer for the XHR network request
        time.sleep(1.5) 
        
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "clientsymbols"))
        )

        js_script = """
        var data = [];
        var rows = document.querySelectorAll('#clientsymbols tbody tr');
        for (var i = 0; i < rows.length; i++) {
            var cols = rows[i].querySelectorAll('td');
            if (cols.length >= 3 && cols[0].innerText.trim() !== '') {
                data.push({
                    'date': cols[0].innerText.trim(),
                    'close_price': cols[1].innerText.trim(),
                    'open_price': cols[2].innerText.trim()
                });
            }
        }
        return data;
        """
        return driver.execute_script(js_script)

# --- 3. The Factory / Router ---
def get_scraper_for_url(url):
    """Parses the URL and returns the appropriate scraper instance."""
    parsed_url = urlparse(url)
    domain = parsed_url.netloc.lower()
    
    # Check for Google Finance
    if "google.com" in domain and "/finance" in parsed_url.path:
        return GoogleFinanceScraper()
        
    # Check for CSCS
    elif "cscs.ng" in domain:  # Using a broader match just in case
        return CSCSScraper()
    
    # Fallback
    return BaseScraper()