import * as React from 'react'

import { Body, Head, Html, Preview } from '@react-email/components'

interface SignupEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  confirmationUrl: string
}

const LOGO_URL =
  'https://augustoij.com.br/__l5e/assets-v1/598c4b3d-6b9f-4b5a-a484-6e195d698b48/augusto-ij-logo-full-dark-FINAL.png'

export const SignupEmail = ({ confirmationUrl }: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail para ativar sua conta no Augusto.IJ</Preview>
    <Body style={{ margin: 0, padding: 0, backgroundColor: '#F4F3F2' }}>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        
        style={{ backgroundColor: '#F4F3F2' }}
      >
        <tr>
          <td align="center" style={{ padding: '24px 12px' }}>
            <table
              role="presentation"
              width={600}
              cellPadding={0}
              cellSpacing={0}
              border={0}
              
              style={{ backgroundColor: '#FFFFFF', maxWidth: 600, width: '100%' }}
            >
              <tr>
                <td
                  align="center"
                  
                  style={{ backgroundColor: '#00512B', padding: '36px 40px' }}
                >
                  <img
                    src={LOGO_URL}
                    width={240}
                    alt="Augusto.IJ — Inteligência Jurídica para Condomínios"
                    style={{ display: 'block', margin: '0 auto', maxWidth: 240, height: 'auto', border: 0 }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ padding: 40, color: '#1F2937', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ margin: '0 0 18px' }}>
                    <tr>
                      <td
                        
                        style={{
                          backgroundColor: '#E7EDE9',
                          borderRadius: 20,
                          padding: '7px 16px',
                          fontFamily: 'Arial, Helvetica, sans-serif',
                          fontSize: 12,
                          fontWeight: 'bold',
                          color: '#00512B',
                        }}
                      >
                        ÚLTIMO PASSO
                      </td>
                    </tr>
                  </table>
                  <h1
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontWeight: 'bold',
                      fontSize: 24,
                      color: '#00512B',
                      margin: '0 0 16px',
                    }}
                  >
                    Confirme seu e-mail para ativar sua conta
                  </h1>
                  <p style={{ fontSize: 15, lineHeight: '1.65', color: '#1F2937', margin: '0 0 14px' }}>
                    Falta um passo para começar a usar o Augusto.IJ: confirmar que este é o seu endereço de e-mail.
                  </p>
                  <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ margin: '26px auto' }}>
                    <tr>
                      <td
                        align="center"
                        
                        style={{ backgroundColor: '#B8935A', borderRadius: 4 }}
                      >
                        <a
                          href={confirmationUrl}
                          style={{
                            display: 'inline-block',
                            padding: '14px 34px',
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            fontSize: 14,
                            fontWeight: 'bold',
                            color: '#FFFFFF',
                            textDecoration: 'none',
                          }}
                        >
                          Confirmar meu e-mail
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style={{ fontSize: 13, lineHeight: '1.6', color: '#475569', margin: '0 0 8px' }}>
                    Este link expira em 24 horas por segurança.
                  </p>
                  <p style={{ fontSize: 13, lineHeight: '1.6', color: '#475569', margin: 0 }}>
                    Se você não criou uma conta no Augusto.IJ, pode ignorar este e-mail com segurança — nenhuma conta será ativada sem essa confirmação.
                  </p>
                </td>
              </tr>
              <tr>
                <td
                  align="center"
                  
                  style={{
                    backgroundColor: '#F4F3F2',
                    padding: '22px 40px',
                    borderTop: '1px solid #E4E1D8',
                  }}
                >
                  <p
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontStyle: 'italic',
                      fontSize: 13,
                      color: '#475569',
                      margin: '0 0 6px',
                    }}
                  >
                    Dura lex, sed Augusto.
                  </p>
                  <p
                    style={{
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: 11,
                      color: '#475569',
                      margin: 0,
                    }}
                  >
                    Augusto.IJ Tecnologia LTDA — Inteligência Jurídica para Condomínios
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </Body>
  </Html>
)

export default SignupEmail
