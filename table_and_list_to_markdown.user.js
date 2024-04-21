// ==UserScript==
// @name         Table/List to Markdown
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Extract tables and lists from any website and save them as Markdown
// @author       fmuaddib
// @match        *://*/*
// @license      MIT
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

   try {
     
    // Function to check if an element is empty
    function isEmptyElement(element) {
        var htmlContent = element.innerHTML;
        var text = htmlContent.replace(/<[^>]*>/g, '').replace(/['"“”„«»‘’`「」《》\s]/g, '');
        return text.trim() === '';
    }

    // htmlToMarkdown function
    function htmlToMarkdown(html) {
        var element = document.createElement('div');
        element.innerHTML = html;
        document.body.appendChild(element); // Add to DOM to compute styles
    
        var markdown = processNode(element);
    
        document.body.removeChild(element); // Clean up
        return markdown;
    }


    
    // processNode function, recursive
    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            let markdown = '';
            switch (node.tagName.toLowerCase()) {
                case 'br':
                    markdown = '<br>  ';  // use both <br> and double space for safely handle new lines
                    break;
                case 'p':
                    markdown = '<br>  \n' + Array.from(node.childNodes).map(processNode).join('') + '<br>  \n';
                    break;
                case 'b':
                case 'strong':
                    markdown = '**' + Array.from(node.childNodes).map(processNode).join('') + '**';
                    break;
                case 'i':
                case 'em':
                    markdown = '*' + Array.from(node.childNodes).map(processNode).join('') + '*';
                    break;
                case 'u':
                    // HTML underline, no Markdown equivalent, using HTML directly
                    markdown = '<u>' + Array.from(node.childNodes).map(processNode).join('') + '</u>';
                    break;
                case 's':
                case 'strike':
                    markdown = '~~' + Array.from(node.childNodes).map(processNode).join('') + '~~';
                    break;
                case 'del':
                    markdown = '~~' + Array.from(node.childNodes).map(processNode).join('') + '~~';
                    break;
                case 'a':
                    markdown = '[' + Array.from(node.childNodes).map(processNode).join('') + '](' + node.href + ')';
                    break;
                case 'img':
                    const altText = node.alt || 'Image';
                    markdown = '![' + altText + '](' + node.src + ')';
                    break;
                case 'span':
                    // For span, just continue processing child nodes, ignoring any styling.
                    markdown = Array.from(node.childNodes).map(processNode).join('');
                    break;
                default:
                    markdown = Array.from(node.childNodes).map(processNode).join('');
                    break;
            }
            return markdown;
        }
        return '';
    }




    // Function to convert element text with styles spans
    function styleText(el) {
        var computedStyle = window.getComputedStyle(el);
        var text = el.textContent;
        var style = '';
        
        // Bold
        if (computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 700) {
            text = '**' + text + '**';
        }
        // Italics
        if (computedStyle.fontStyle === 'italic') {
            text = '*' + text + '*';
        }
        // Strikethrough
        if (computedStyle.textDecorationLine.includes('line-through')) {
            text = '~~' + text + '~~';
        }
        // Underline - Markdown does not natively support underlines, so we use HTML
        if (computedStyle.textDecorationLine.includes('underline')) {
            text = '<u>' + text + '</u>';
        }
        
        return text;
    }
        


    // Function to download data to a file
    function download(data, filename, type) {
        var file = new Blob([data], { type: type });
        if (window.navigator.msSaveOrOpenBlob) // IE10+
            window.navigator.msSaveOrOpenBlob(file, filename);
        else { // Others
            var a = document.createElement("a"),
                url = URL.createObjectURL(file);
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        }
    }

    // Get all tables
    let tables = findTables(document);

    // Get all lists (unordered, ordered, and description)
    let lists = findLists(document);
  

 

    function findTables(doc) {
       
        let tables = doc.getElementsByTagName("table");
        tables = Array.from(tables);
      
        let iframes_elements = doc.getElementsByTagName("iframe");
        for (let found_frame of iframes_elements) {
          let frm_tables = found_frame.contentWindow.document.getElementsByTagName('table');
          frm_tables = Array.from(frm_tables);
          tables.push(...frm_tables);
        }
      
        console.log(`Found ${tables.length} tables in document/frame.`);
        return Array.from(tables);  // Ensure the function always returns an iterable array
    }



    function findLists(doc) {
      
        
        let lists = doc.querySelectorAll('ul, ol, dl');
        lists = Array.from(lists);
      
        let iframes_elements = doc.getElementsByTagName("iframe");
        for (let found_frame of iframes_elements) {
          let frm_lists = found_frame.contentWindow.document.querySelectorAll('ul, ol, dl');
          frm_lists = Array.from(frm_lists);
          lists.push(...frm_lists);
        }
      
        console.log(`Found ${lists.length} lists in document/frame.`);
        return Array.from(lists);  // Ensure the function always returns an iterable array
    }

  


    

    let pageTitle = document.title.replace(/ /g, '_');

    // Process tables
    for (let table of tables) {
       if (isEmptyElement(table)) continue;
       if (table.rows.length < 3) continue;

        let button = document.createElement('button');
        button.innerText = 'Download Table as Markdown';
        button.onclick = function () {
            let md = '';
            let tableTitle = 'table';
            let prevNode = table.previousElementSibling;

            while (prevNode) {
                if (prevNode.nodeName.toLowerCase() === 'h3' || prevNode.nodeName.toLowerCase() === 'h2') {
                    tableTitle = prevNode.innerText.replace(/ /g, '_');
                    break;
                }
                prevNode = prevNode.previousElementSibling;
            }

            if (table.rows.length < 3) return;

            let rows = table.rows;
            for (let i = 0; i < rows.length; i++) {
                let cells = Array.from(rows[i].cells);
                let row = cells.map(cell => {
                    if (isEmptyElement(cell)) return '';
                    let content = htmlToMarkdown(cell.innerHTML);
                    return content;
                }).join('|');
                md += row + '\n';
                if (i === 0) {
                    md += cells.map(() => '---').join('|') + '\n';
                }
            }

            download(md, tableTitle + ' - ' + pageTitle + '.md', 'text/markdown');
        };

        table.parentNode.insertBefore(button, table);
    }

    // Process lists
    for (let list of lists) {
        if (isEmptyElement(list)) continue;

        let listType = list.nodeName.toLowerCase();
        let button = document.createElement('button');
        button.innerText = 'Download List as Markdown';
        button.onclick = function () {
            let md = '';
            let listTitle = 'list';
            let prevNode = list.previousElementSibling;

            while (prevNode) {
                if (prevNode.nodeName.toLowerCase() === 'h3' || prevNode.nodeName.toLowerCase() === 'h2') {
                    listTitle = prevNode.innerText.replace(/ /g, '_');
                    break;
                }
                prevNode = prevNode.previousElementSibling;
            }

            let elements = (listType === 'dl') ? list.getElementsByTagName('dt') : list.getElementsByTagName('li');
            if (elements.length < 2) return;

            if (listType === 'ul' || listType === 'ol') {
                let i = 1;
                for (let li of elements) {
                    if (isEmptyElement(li)) continue;
                    md += `${i}. ${htmlToMarkdown(li.innerHTML)}\n`;
                    i++;
                }
            } else if (listType === 'dl') {
                let dds = list.getElementsByTagName('dd');
                for (let i = 0; i < elements.length; i++) {
                    let dt = elements[i];
                    if (isEmptyElement(dt)) continue;
                    md += `**${htmlToMarkdown(dt.innerHTML)}**\n`;
                    if (i < dds.length) {
                        let dd = dds[i];
                        if (isEmptyElement(dd)) continue;
                        md += `${htmlToMarkdown(dd.innerHTML)}\n`;
                    }
                }
            }

            download(md, listTitle + ' - ' + pageTitle + '.md', 'text/markdown');
        };

        list.parentNode.insertBefore(button, list);
    }
     
   } catch (e) {
         let err_msg = e.toString() + "\n\n\n" + e.stack + "\n\n\n" + e.name + "\n\n\n" + e.message + "\n\n\n" + e.at + "\n\n\n" + e.text+"\n\n\n";
         alert("GM userscript ERROR: "+err_msg);
         console.error("GM userscript ERROR: ", e);
    }
    
})();







    
    






































    
    
    
    
    

